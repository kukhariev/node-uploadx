import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CompleteMultipartUploadOutput,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  ObjectCannedACL,
  Part,
  S3Client,
  S3ClientConfig,
  UploadPartCommand,
  UploadPartCommandInput,
  waitUntilBucketExists
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BaseStorage,
  BaseStorageOptions,
  createMetaStorage,
  ERRORS,
  fail,
  File,
  FileInit,
  FilePart,
  FileQuery,
  getFileStatus,
  hasContent,
  IncomingMessage,
  LocalMetaStorageOptions,
  mapValues,
  MetaStorage,
  partMatch,
  toSeconds,
  updateSize,
  UploadxErrorResponse
} from '@uploadx/core';
import bytes from 'bytes';
import { PassThrough } from 'stream';
import { AWSError } from './aws-error';
import { S3MetaStorage, S3MetaStorageOptions } from './s3-meta-storage';

const BUCKET_NAME = 'node-uploadx';
const MIN_PART_SIZE = 5 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;
const PART_TIMEOUT = 300_000;

export class S3File extends File {
  Parts?: Part[];
  UploadId?: string;
  uri?: string;
  partsUrls?: string[];
  partSize?: number;
}

export type S3StorageOptions = BaseStorageOptions<S3File> &
  S3ClientConfig & {
    /**
     * S3 bucket
     * @defaultValue 'node-uploadx'
     */
    bucket?: string;
    /**
     *   Specifying access rules for uploaded files
     */
    acl?: ObjectCannedACL;
    /**
     * Force compatible client upload directly to S3 storage
     */
    clientDirectUpload?: boolean;
    /**
     * The parts size that the client should use for presigned multipart unloading
     * @defaultValue '16MB'
     */
    partSize?: number | string;
    /**
     * Metafiles storage directory.
     * When set, metafiles are stored locally instead of in S3.
     */
    metaDir?: string;
    /**
     * Configure metafiles storage
     * @example
     * Using local metafiles
     * ```ts
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageOptions: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     * Using a separate bucket for metafiles
     * ```ts
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageOptions: { bucket: 'upload-metafiles' }
     * })
     * ```
     */
    metaStorageOptions?: LocalMetaStorageOptions | S3MetaStorageOptions;
    /** @deprecated Use {@link metaStorageOptions} instead */
    metaStorageConfig?: LocalMetaStorageOptions | S3MetaStorageOptions;
    /**
     * @deprecated Use standard auth providers
     */
    keyFile?: string;
  };

/**
 * S3 storage based backend.
 * @example
 * ```ts
 * const storage = new S3Storage({
 *  bucket: <YOUR_BUCKET>,
 *  endpoint: <YOUR_ENDPOINT>,
 *  region: <YOUR_REGION>,
 *  credentials: {
 *    accessKeyId: <YOUR_ACCESS_KEY_ID>,
 *    secretAccessKey: <YOUR_SECRET_ACCESS_KEY>
 *  },
 *  metaStorageOptions: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 */
export class S3Storage extends BaseStorage<S3File> {
  bucket: string;
  client: S3Client;
  meta: MetaStorage<S3File>;
  checksumTypes = ['md5'];
  private readonly _partSize = PART_SIZE;

  constructor(public options: S3StorageOptions = {}) {
    super(options);
    this.bucket = options.bucket || BUCKET_NAME;
    if (options.keyFile) {
      options.credentials = fromIni({ configFilepath: options.keyFile });
    }
    this._partSize = bytes.parse(this.options.partSize || PART_SIZE);
    if (this._partSize < MIN_PART_SIZE) {
      throw new Error('Minimum allowed partSize value is 5MB');
    }
    if (this.options.clientDirectUpload) {
      this.onCreate = async file => ({ statusCode: 200, body: file }); // TODO: remove hook
    }
    const clientConfig = { ...options };
    this.client = new S3Client(clientConfig);
    this.meta = createMetaStorage(options, S3MetaStorage);
    this.isReady = false;
    this.accessCheck()
      .then(() => (this.isReady = true))
      .catch(error => this.logger.error('Storage access check failed: {error.message}', { error }));
  }

  normalizeError(error: AWSError): UploadxErrorResponse {
    if (error.$metadata) {
      return {
        message: error.message,
        code: error.Code || error.name,
        statusCode: error.$metadata.httpStatusCode || 500,
        name: error.name
      };
    }
    return super.normalizeError(error);
  }

  async create(req: IncomingMessage, config: FileInit): Promise<S3File> {
    const file = new S3File(config);
    file.name = this.namingFunction(file, req);
    await this.validate(file);
    try {
      const existing = await this.getMeta(file.id);
      if (existing.bytesWritten >= 0) {
        return existing;
      }
    } catch {}

    const params = {
      Bucket: this.bucket,
      Key: file.name,
      ContentType: file.contentType,
      Metadata: mapValues(file.metadata, encodeURI),
      ACL: this.options.acl
    };
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand(params));
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    file.UploadId = UploadId;
    file.bytesWritten = 0;
    if (this.options.clientDirectUpload) {
      file.partSize ??= this._partSize;
    }
    await this.saveMeta(file);
    file.status = 'created';
    if (this.options.clientDirectUpload) return this.buildPresigned(file);
    return file;
  }

  async write(part: FilePart | FileQuery): Promise<S3File> {
    const file = await this.getMeta(part.id);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (part.size) updateSize(file, part.size);
    if (!partMatch(part, file)) return fail(ERRORS.FILE_CONFLICT);
    if (this.options.clientDirectUpload) return this.buildPresigned(file);
    file.Parts ??= await this._getParts(file);
    file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce((p, c) => p + c, 0);
    if (hasContent(part)) {
      if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
        return fail(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
      }
      const partNumber = file.Parts.length + 1;
      const upstream = part.body;
      const body = upstream.pipe(new PassThrough());
      const controller = new AbortController();
      const abortSignal = controller.signal;
      const onUpstreamGone = (): void => {
        controller.abort();
        body.destroy();
      };
      upstream.once('error', onUpstreamGone);
      upstream.once('abort', onUpstreamGone);
      const timeoutId = setTimeout(() => {
        this.logger.warn(`Upload part timeout: ${file.name}, part ${partNumber}`);
        onUpstreamGone();
      }, PART_TIMEOUT);

      const params: UploadPartCommandInput = {
        Bucket: this.bucket,
        Key: file.name,
        UploadId: file.UploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: part.contentLength || 0
      };
      if (part.checksumAlgorithm === 'md5') {
        params.ContentMD5 = part.checksum;
      }

      try {
        const { ETag } = await this.client.send(new UploadPartCommand(params), { abortSignal });
        const uploadPart: Part = { PartNumber: partNumber, Size: part.contentLength, ETag };
        file.Parts = [...file.Parts, uploadPart];
        file.bytesWritten += part.contentLength || 0;
      } finally {
        clearTimeout(timeoutId);
        upstream.removeListener('error', onUpstreamGone);
        upstream.removeListener('abort', onUpstreamGone);
        body.destroy();
      }
    }
    this.cache.set(file.id, file);
    file.status = getFileStatus(file);
    if (file.status === 'completed') {
      const [completed] = await this._onComplete(file);
      delete file.Parts;
      file.uri = completed.Location;
    }
    return file;
  }

  async delete({ id }: FileQuery): Promise<S3File[]> {
    const file = await this.getMeta(id).catch(() => null);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this.deleteMeta(file.id), this._abortMultipartUpload(file)]);
      return [{ ...file }];
    }
    return [{ id } as S3File];
  }

  async update({ id }: FileQuery, metadata: Partial<S3File>): Promise<S3File> {
    if (this.options.clientDirectUpload) {
      const file = await this.getMeta(id);
      return this.buildPresigned({ ...file, ...metadata });
    }
    return super.update({ id }, metadata);
  }

  accessCheck(maxWaitTime = 30): Promise<any> {
    return waitUntilBucketExists({ client: this.client, maxWaitTime }, { Bucket: this.bucket });
  }

  private async buildPresigned(file: S3File): Promise<S3File> {
    if (!file.Parts?.length) {
      file.Parts = await this._getParts(file);
    }
    file.bytesWritten = Math.min(file.Parts.length * this._partSize, file.size);
    file.status = getFileStatus(file);
    if (file.status === 'completed') {
      const [completed] = await this._onComplete(file);
      delete file.Parts;
      delete file.partsUrls;
      file.uri = completed.Location;
      return file;
    }
    if (!file.partsUrls?.length) {
      file.partsUrls = await this.getPartsPresignedUrls(file);
    }
    return file;
  }

  private async getPartsPresignedUrls(file: S3File): Promise<string[]> {
    file.partSize ??= this._partSize;
    const partsNum = ~~(file.size / this._partSize) + 1;
    const promises = [];
    const expiresIn = toSeconds(this.config.expiration?.maxAge || '6hrs');
    for (let i = 0; i < partsNum; i++) {
      const partCommandInput = {
        Bucket: this.bucket,
        Key: file.name,
        UploadId: file.UploadId,
        PartNumber: i + 1
      };
      promises.push(
        getSignedUrl(this.client, new UploadPartCommand(partCommandInput), { expiresIn })
      );
    }
    return Promise.all(promises);
  }

  private _onComplete = (file: S3File): Promise<[CompleteMultipartUploadOutput, any]> => {
    return Promise.all([this._completeMultipartUpload(file), this.deleteMeta(file.id)]);
  };

  private async _getParts(file: S3File): Promise<Part[]> {
    const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
    const { Parts = [] } = await this.client.send(new ListPartsCommand(params));
    return Parts;
  }

  private _completeMultipartUpload(file: S3File): Promise<CompleteMultipartUploadOutput> {
    const params = {
      Bucket: this.bucket,
      Key: file.name,
      UploadId: file.UploadId,
      MultipartUpload: {
        Parts: file.Parts?.map(({ ETag, PartNumber }) => ({ ETag, PartNumber }))
      }
    };
    return this.client.send(new CompleteMultipartUploadCommand(params));
  }

  private async _abortMultipartUpload(file: S3File): Promise<any> {
    if (file.status === 'completed') return;
    try {
      const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
      await this.client.send(new AbortMultipartUploadCommand(params));
    } catch (error) {
      this.logger.error('Abort multipart upload failed', { error });
    }
  }
}
