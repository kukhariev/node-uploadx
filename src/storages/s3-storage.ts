import { S3 } from 'aws-sdk';
import * as http from 'http';
import { ERRORS, fail } from '../util/errors';
import { logger } from '../util/utils';
import { File, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, filename } from './storage';

const log = logger.extend('S3');
const META = '.META';
const BUCKET_NAME = 'uploadx';

export interface S3File extends File {
  Parts: S3.Parts;
  UploadId: string;
}

export type S3StorageOptions = BaseStorageOptions &
  S3.ClientConfiguration & {
    /**
     * AWS S3 bucket
     * @defaultValue 'uploadx'
     */
    bucket?: string;
  };

export function processMetadata(
  metadata: Record<string, any>,
  func: (value: any) => string
): Record<string, string> {
  const encoded: Record<string, string> = {};
  for (const k in metadata) {
    encoded[k] = func(metadata[k]);
  }
  return encoded;
}

export class S3Storage extends BaseStorage {
  bucket: string;
  client: S3;
  metaStore: Record<string, S3File> = {};

  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: S3StorageOptions) {
    super(config);
    this._getFileName = config.filename || filename;
    this.bucket = config.bucket || BUCKET_NAME;
    this.client = new S3(config);
    this._checkIfBucketExist()
      .catch(err => {
        throw err;
      })
      .then(() => this._listMultipartUploads())
      .then(data => log('Incomplete Uploads: ', data.Uploads?.length))
      .catch(err => log('Incomplete Uploads fetch error:', err));

    // if (config.expire) {
    //   const expireRules: S3.LifecycleRule = {
    //     ID: 'DeleteIncompleteMultipartUploads',
    //     Filter: { Prefix: '' },
    //     AbortIncompleteMultipartUpload: { DaysAfterInitiation: config.expire },
    //     Status: 'Disabled'
    //   };
    //   this.client
    //     .putBucketLifecycleConfiguration({
    //       Bucket: this.bucketName,
    //       LifecycleConfiguration: {
    //         Rules: [expireRules]
    //       }
    //     })
    //     .promise()
    //     .catch(err => log(err));
    // }
  }

  async create(req: http.IncomingMessage, file: S3File): Promise<File> {
    const errors = this.validate(file);
    if (errors.length) return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());

    const path = this._getFileName(file);
    const existing = this.metaStore[path];
    if (existing) return existing as File;
    const metadata = processMetadata(file.metadata, encodeURI);

    const multiPartOptions = {
      Bucket: this.bucket,
      Key: path,
      ContentType: file.mimeType,
      Metadata: metadata
    };

    const { UploadId } = await this.client.createMultipartUpload(multiPartOptions).promise();
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    file.UploadId = UploadId;
    file.path = path;
    await this._saveMeta(path, file);
    file.status = 'created';
    return file;
  }

  async write(chunk: FilePart): Promise<File> {
    const file = await this._getMeta(chunk.path);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    if (Number(chunk.start) >= 0) {
      await this._write({ ...file, ...chunk });
    }
    if (file.bytesWritten === file.size) {
      const completed = await this._complete(file);
      await this.client.deleteObject({ Bucket: this.bucket, Key: file.path + META }).promise();
      delete this.metaStore[file.path];
      file.path = completed.Location;
    }
    return file;
  }

  async delete(path: string): Promise<File[]> {
    const file = await this._getMeta(path);

    if (file) {
      file.status = 'deleted';
      await this.client
        .deleteObject({ Bucket: this.bucket, Key: file.path + META })
        .promise()
        .catch(err => {});
      const params = { Bucket: this.bucket, Key: file.path, UploadId: file.UploadId };
      await this.client
        .abortMultipartUpload(params)
        .promise()
        .catch(err => log('abort error:', err.code));
    }
    delete this.metaStore[file.path];
    return [{ path } as File];
  }

  async get(prefix: string): Promise<File[]> {
    const { Contents } = await this.client
      .listObjectsV2({ Bucket: this.bucket, Prefix: prefix })
      .promise();
    return Contents as any;
  }

  async _write(file: S3File & FilePart): Promise<S3.UploadPartOutput> {
    const partNumber = (file.Parts || []).length + 1;
    const data: S3.UploadPartOutput = await this.client
      .uploadPart({
        Bucket: this.bucket,
        Key: file.path,
        UploadId: file.UploadId,
        PartNumber: partNumber,
        Body: file.body,
        ContentLength: file.contentLength
      })
      .promise();
    if (file.status === 'deleted') {
      delete this.metaStore[file.path];
      return data;
    }
    const part: S3.Part = { ...data, ...{ PartNumber: partNumber, Size: file.contentLength } };
    this.metaStore[file.path].bytesWritten = file.bytesWritten + (file.contentLength || 0);
    this.metaStore[file.path].Parts = [...(file.Parts || []), part];
    return data;
  }

  _listParts(key: string, uploadId: string): Promise<S3.ListPartsOutput> {
    const opts = { Bucket: this.bucket, Key: key, UploadId: uploadId };
    return this.client.listParts(opts).promise();
  }

  private _listMultipartUploads(): Promise<S3.ListMultipartUploadsOutput> {
    return this.client.listMultipartUploads({ Bucket: this.bucket }).promise();
  }

  private _complete(meta: S3File): Promise<any> {
    return this.client
      .completeMultipartUpload({
        Bucket: this.bucket,
        Key: meta.path,
        UploadId: meta.UploadId,
        MultipartUpload: {
          Parts: meta.Parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber }))
        }
      })
      .promise();
  }

  private _checkIfBucketExist(): Promise<any> {
    return this.client.headBucket({ Bucket: this.bucket }).promise();
  }

  private async _saveMeta(path: string, file: S3File): Promise<any> {
    const encodedFile = encodeURIComponent(JSON.stringify(file));
    await this.client
      .putObject({
        Bucket: this.bucket,
        Key: path + META,
        Metadata: { metadata: encodedFile }
      })
      .promise();
    this.metaStore[path] = { ...file, ...{ Parts: [] } };
  }

  private async _getMeta(path: string): Promise<S3File> {
    let file: S3File = this.metaStore[path];
    if (file) return file;
    const { Metadata } = await this.client
      .headObject({ Bucket: this.bucket, Key: path + META })
      .promise();
    if (Metadata) {
      file = JSON.parse(decodeURIComponent(Metadata.metadata));
      const { Parts } = await this._listParts(path, file?.UploadId);
      file.Parts = Parts || [];
      file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce(
        (prev, next) => prev + next,
        0
      );
      this.metaStore[path] = file;
      return file;
    }
    return fail(ERRORS.FILE_NOT_FOUND);
  }
}
