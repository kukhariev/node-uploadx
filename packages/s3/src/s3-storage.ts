import * as bytes from 'bytes';
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
  waitUntilBucketExists
} from '@aws-sdk/client-s3';
import { AbortController } from '@aws-sdk/abort-controller';
import { fromIni } from '@aws-sdk/credential-providers';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BaseStorage,
  BaseStorageOptions,
  ERRORS,
  fail,
  File,
  FileInit,
  FilePart,
  FileQuery,
  getFileStatus,
  hasContent,
  HttpError,
  IncomingMessage,
  LocalMetaStorage,
  LocalMetaStorageOptions,
  mapValues,
  MetaStorage,
  partMatch,
  toBoolean,
  toSeconds,
  updateSize
} from '@uploadx/core';
import { AWSError } from './aws-error';
import { S3MetaStorage, S3MetaStorageOptions } from './s3-meta-storage';

const BUCKET_NAME = 'node-uploadx';
const MIN_PART_SIZE = 5 * 1024 * 1024;
const PART_SIZE = 16 * 1024 * 1024;

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
     * Configure metafiles storage
     * @example
     * Using local metafiles
     * ```ts
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * ```
     * Using a separate bucket for metafiles
     * ```ts
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageConfig: { bucket: 'upload-metafiles' }
     * })
     * ```
     */
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
 *  metaStorageConfig: { directory: '/tmp/upload-metafiles' }
 * });
 * ```
 */
export class S3Storage extends BaseStorage<S3File> {
  bucket: string;
  client: S3Client;
  meta: MetaStorage<S3File>;
  checksumTypes = ['md5'];
  private readonly _partSize = PART_SIZE;

  constructor(public config: S3StorageOptions = {}) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && (config.credentials = fromIni({ configFilepath: keyFile }));
    this._partSize = bytes.parse(this.config.partSize || PART_SIZE);
    if (this._partSize < MIN_PART_SIZE) {
      throw new Error('Minimum allowed partSize value is 5MB');
    }
    if (this.config.clientDirectUpload) {
      this.onCreate = async file => ({ body: file }); // TODO: remove hook
    }
    const clientConfig = { ...config };
    clientConfig.logger = toBoolean(process.env.S3_DEBUG) ? this.logger : undefined;
    this.client = new S3Client(clientConfig);
    if (config.metaStorage) {
      this.meta = config.metaStorage;
    } else {
      const metaConfig = { ...config, ...config.metaStorageConfig };
      this.meta =
        'directory' in metaConfig
          ? new LocalMetaStorage(metaConfig)
          : new S3MetaStorage(metaConfig);
    }
    this.isReady = false;
    this.accessCheck()
      .then(() => (this.isReady = true))
      .catch(err => this.logger.error('Storage access check failed: %O', err));
  }

  normalizeError(error: AWSError): HttpError {
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
      ACL: this.config.acl
    };
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand(params));
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    file.UploadId = UploadId;
    file.bytesWritten = 0;
    if (this.config.clientDirectUpload) {
      file.partSize ??= this._partSize;
    }
    await this.saveMeta(file);
    file.status = 'created';
    if (this.config.clientDirectUpload) return this.buildPresigned(file);
    return file;
  }

  async write(part: FilePart | FileQuery): Promise<S3File> {
    const file = await this.getMeta(part.id);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (part.size) updateSize(file, part.size);
    if (!partMatch(part, file)) return fail(ERRORS.FILE_CONFLICT);
    if (this.config.clientDirectUpload) return this.buildPresigned(file);
    file.Parts ??= await this._getParts(file);
    file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce((p, c) => p + c, 0);
    await this.lock(part.id);
    try {
      if (hasContent(part)) {
        if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
          return fail(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
        }
        const checksumMD5 = part.checksumAlgorithm === 'md5' ? part.checksum : '';
        const partNumber = file.Parts.length + 1;
        const params = {
          Bucket: this.bucket,
          Key: file.name,
          UploadId: file.UploadId,
          PartNumber: partNumber,
          Body: part.body,
          ContentLength: part.contentLength || 0,
          ContentMD5: checksumMD5
        };
        const abortSignal = new AbortController().signal;
        part.body.on('error', _err => abortSignal.abort());
        const { ETag } = await this.client.send(new UploadPartCommand(params), { abortSignal });
        const uploadPart: Part = { PartNumber: partNumber, Size: part.contentLength, ETag };
        file.Parts = [...file.Parts, uploadPart];
        file.bytesWritten += part.contentLength || 0;
      }
      this.cache.set(file.id, file);
      file.status = getFileStatus(file);
      if (file.status === 'completed') {
        const [completed] = await this._onComplete(file);
        delete file.Parts;
        file.uri = completed.Location;
      }
    } finally {
      await this.unlock(part.id);
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
    if (this.config.clientDirectUpload) {
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
    } catch (err) {
      this.logger.error('_abortMultipartUploadError: ', err);
    }
  }
}
