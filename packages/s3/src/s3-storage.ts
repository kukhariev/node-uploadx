import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CompleteMultipartUploadOutput,
  CopyObjectCommand,
  CopyObjectCommandInput,
  CopyObjectCommandOutput,
  CreateMultipartUploadCommand,
  CreateMultipartUploadRequest,
  DeleteObjectCommand,
  DeleteObjectCommandInput,
  HeadBucketCommand,
  ListMultipartUploadsCommand,
  ListPartsCommand,
  Part,
  S3Client,
  S3ClientConfig,
  UploadPartCommand,
  UploadPartRequest
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import {
  BaseStorage,
  BaseStorageOptions,
  ERRORS,
  fail,
  File,
  FileInit,
  FilePart,
  hasContent,
  HttpError,
  isCompleted,
  isValidPart,
  LocalMetaStorage,
  LocalMetaStorageOptions,
  mapValues,
  MetaStorage
} from '@uploadx/core';
import * as http from 'http';
import { AWSError } from './aws-error';
import { S3MetaStorage, S3MetaStorageOptions } from './s3-meta-storage';
import { resolve } from 'url';

const BUCKET_NAME = 'node-uploadx';

export interface S3File extends File {
  Parts?: Part[];
  UploadId?: string;
  uri?: string;
  move: (dest: string) => Promise<Record<string, any>>;
  copy: (dest: string) => Promise<Record<string, any>>;
  get: () => Promise<Record<string, any>>;
  delete: () => Promise<any>;
}

export type S3StorageOptions = BaseStorageOptions<S3File> &
  S3ClientConfig & {
    /**
     * S3 bucket
     * @defaultValue 'node-uploadx'
     */
    bucket?: string;
    keyFile?: string;
    /**
     * Configure metafiles storage
     * @example
     * // use local metafiles
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageConfig: { directory: '/tmp/upload-metafiles' }
     * })
     * @example
     * // use a separate bucket for metafiles
     * const storage = new S3Storage({
     *   bucket: 'uploads',
     *   region: 'eu-west-3',
     *   metaStorageConfig: { bucket: 'upload-metafiles' }
     * })
     */
    metaStorageConfig?: LocalMetaStorageOptions | S3MetaStorageOptions;
  };

/**
 * S3 storage based backend.
 * @example
   const storage = new S3Storage({
    bucket: <YOUR_BUCKET>,
    endpoint: <YOUR_ENDPOINT>,
    region: <YOUR_REGION>,
    credentials: {
      accessKeyId: <YOUR_ACCESS_KEY_ID>,
      secretAccessKey: <YOUR_SECRET_ACCESS_KEY>
    },
    metaStorageConfig: { directory: '/tmp/upload-metafiles' }
  });
 */
export class S3Storage extends BaseStorage<S3File> {
  bucket: string;
  client: S3Client;
  meta: MetaStorage<S3File>;

  constructor(public config: S3StorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && (config.credentials = fromIni({ configFilepath: keyFile }));
    this.client = new S3Client(config);
    if (config.metaStorage) {
      this.meta = config.metaStorage;
    } else {
      const metaConfig = { ...config, ...(config.metaStorageConfig || {}) };
      this.meta =
        'directory' in metaConfig
          ? new LocalMetaStorage(metaConfig)
          : new S3MetaStorage(metaConfig);
    }
    this._checkBucket();
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

  async create(req: http.IncomingMessage, config: FileInit): Promise<S3File> {
    const file = new File(config) as S3File;
    file.name = this.namingFunction(file);
    await this.validate(file);
    try {
      const existing = await this.getMeta(file.name);
      if (existing.bytesWritten >= 0) {
        return existing;
      }
    } catch {}

    const params: CreateMultipartUploadRequest = {
      Bucket: this.bucket,
      Key: file.name,
      ContentType: file.contentType,
      Metadata: mapValues(file.metadata, encodeURI)
    };
    const { UploadId } = await this.client.send(new CreateMultipartUploadCommand(params));
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    file.UploadId = UploadId;
    file.bytesWritten = 0;
    await this.saveMeta(file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<S3File> {
    const file = await this.getMeta(part.name);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);

    file.Parts ??= await this._getParts(file);
    file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce(
      (prev, next) => prev + next,
      0
    );
    if (hasContent(part)) {
      const partNumber = file.Parts.length + 1;
      const params: UploadPartRequest = {
        Bucket: this.bucket,
        Key: file.name,
        UploadId: file.UploadId,
        PartNumber: partNumber,
        Body: part.body,
        ContentLength: part.contentLength || 0
      };
      const { ETag } = await this.client.send(new UploadPartCommand(params));
      const uploadPart: Part = { PartNumber: partNumber, Size: part.contentLength, ETag };
      file.Parts = [...file.Parts, uploadPart];
      file.bytesWritten += part.contentLength || 0;
    }
    this.cache.set(file.name, file);
    if (isCompleted(file)) {
      const [completed] = await this._onComplete(file);
      delete file.Parts;
      file.uri = completed.Location;
      return this.buildCompletedFile(file);
    }
    return file;
  }

  async delete(name: string): Promise<S3File[]> {
    const file = await this.getMeta(name).catch(() => null);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this.deleteMeta(file.name), this._abortMultipartUpload(file)]);
      return [{ ...file }];
    }
    return [{ name } as S3File];
  }

  async copy(name: string, dest: string): Promise<CopyObjectCommandOutput> {
    const CopySource = `${this.bucket}/${name}`;
    const newPath = decodeURI(resolve(`/${CopySource}`, dest)); // path.resolve?
    const [, Bucket, ...pathSegments] = newPath.split('/');
    const Key = pathSegments.join('/');
    const params: CopyObjectCommandInput = { Bucket, Key, CopySource };
    return this.client.send(new CopyObjectCommand(params));
  }

  async move(name: string, dest: string): Promise<CopyObjectCommandOutput> {
    const copyOut = await this.copy(name, dest);
    const params: DeleteObjectCommandInput = { Bucket: this.bucket, Key: name };
    await this.client.send(new DeleteObjectCommand(params));
    return copyOut;
  }

  buildCompletedFile(file: S3File): S3File {
    const completed = { ...file };
    completed.lock = async lockFn => {
      completed.lockedBy = lockFn;
      return Promise.resolve(completed.lockedBy);
    };
    completed.delete = () => this.delete(file.name);
    completed.copy = async (dest: string) => this.copy(file.name, dest);
    completed.move = async (dest: string) => this.move(file.name, dest);

    return completed;
  }

  protected _onComplete = (file: S3File): Promise<[CompleteMultipartUploadOutput, any]> => {
    return Promise.all([this._complete(file), this.deleteMeta(file.name)]);
  };

  private async _getParts(file: S3File): Promise<Part[]> {
    const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
    const { Parts = [] } = await this.client.send(new ListPartsCommand(params));
    return Parts;
  }

  private _complete(file: S3File): Promise<CompleteMultipartUploadOutput> {
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
      this.log('_abortMultipartUploadError: ', err);
    }
  }

  private _checkBucket(): void {
    this.client.send(new HeadBucketCommand({ Bucket: this.bucket }), (err: AWSError) => {
      if (err) {
        throw err;
      }
      this.isReady = true;
      this.log.enabled && this._listMultipartUploads();
    });
  }

  private _listMultipartUploads(): void {
    this.client.send(new ListMultipartUploadsCommand({ Bucket: this.bucket }), (err, data) => {
      err && this.log('Incomplete Uploads fetch error:', err);
      data && this.log('Incomplete Uploads: ', data.Uploads?.length);
    });
  }
}
