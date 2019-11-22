import { S3 } from 'aws-sdk';
import * as http from 'http';
import { Readable } from 'stream';
import { ERRORS, fail, File, FilePart } from '.';
import { BaseStorage, BaseStorageOptions } from './storage';
import { logger } from './utils';

const log = logger.extend('S3');
const META_SUFFIX = '.META';
const PACKAGE_NAME = 'node-uploadx';

export interface S3Meta extends File {
  UploadId: string;
  Parts: S3.Parts;
}

export type S3StorageOptions = BaseStorageOptions &
  S3.ClientConfiguration & {
    bucketName?: string;
    namingFunction?: (file: Partial<File>) => string;
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
const namingFunction = ({ userId, id }: Partial<File>): string =>
  userId ? `${userId}/${id || ''}` : `${id}`;

export class S3Storage extends BaseStorage {
  bucketName: string;
  client: S3;
  metaStore: Record<string, S3Meta> = {};
  /**
   *  @internal
   */
  _removeCompletedOnDelete = false;
  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: S3StorageOptions) {
    super(config);
    this._getFileName = config.namingFunction || namingFunction;
    this.bucketName = config.bucketName || PACKAGE_NAME;
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

  async create(req: http.IncomingMessage, file: File): Promise<File> {
    const errors = this.validate(file);
    if (errors.length) return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());

    const key = this._getFileName(file);
    const existing = this.metaStore[key];
    if (existing) return existing as File;
    const metadata = processMetadata(file.metadata, encodeURI);

    const multiPartOptions = {
      Bucket: this.bucketName,
      Key: key,
      ContentType: file.mimeType,
      Metadata: metadata
    };

    const { UploadId } = await this.client.createMultipartUpload(multiPartOptions).promise();
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    const encodedFile = encodeURIComponent(JSON.stringify({ ...file, UploadId }));
    await this.client
      .putObject({
        Bucket: this.bucketName,
        Key: key + META_SUFFIX,
        Metadata: { metadata: encodedFile }
      })
      .promise();
    this.metaStore[key] = { ...file, UploadId, ...{ Parts: [] } };
    file.path = this._getFileName(file);
    file.status = 'created';
    return file;
  }

  async write(stream: Readable, range: FilePart): Promise<File> {
    const key = this._getFileName(range);
    const file = this.metaStore[key] || (await this._getMeta(key));
    if (range.start >= 0) {
      await this._write(stream, key, file);
    }
    if (file.bytesWritten === file.size) {
      const completed = await this._complete(key, file);
      await this.client.deleteObject({ Bucket: this.bucketName, Key: key + META_SUFFIX }).promise();
      delete this.metaStore[key];
      file.path = completed.Location;
    }
    return file;
  }

  async delete(query: Partial<File>): Promise<File[]> {
    const key = this._getFileName(query);
    const file = this.metaStore[key] || (await this._getMeta(key).catch(err => {})) || query;

    if (file.UploadId) {
      file.status = 'deleted';
      await this.client
        .deleteObject({ Bucket: this.bucketName, Key: key + META_SUFFIX })
        .promise()
        .catch(err => {});
      const params = { Bucket: this.bucketName, Key: key, UploadId: file.UploadId };
      await this.client
        .abortMultipartUpload(params)
        .promise()
        .catch(err => log('abort error:', err.code));
    }
    if (this._removeCompletedOnDelete) {
      await this.client.deleteObject({ Bucket: this.bucketName, Key: key }).promise();
    }
    return [query] as File[];
  }

  async get(file: Partial<File>): Promise<File[]> {
    const key = this._getFileName(file);
    const { Contents } = await this.client
      .listObjectsV2({ Bucket: this.bucketName, Prefix: key })
      .promise();
    return Contents as any;
  }

  async _write(body: any, key: string, file: S3Meta): Promise<S3.UploadPartOutput> {
    const contentLength = +body.headers['content-length'] || body.byteCount;
    const partNumber = (file.Parts || []).length + 1;
    const data: S3.UploadPartOutput = await this.client
      .uploadPart({
        Bucket: this.bucketName,
        Key: key,
        UploadId: file.UploadId,
        PartNumber: partNumber,
        Body: body,
        ContentLength: contentLength
      })
      .promise();
    if (file.status === 'deleted') {
      delete this.metaStore[key];
      return data;
    }
    const part: S3.Part = { ...data, ...{ PartNumber: partNumber, Size: contentLength } };
    this.metaStore[key].bytesWritten = file.bytesWritten + contentLength;
    this.metaStore[key].Parts = [...(file.Parts || []), part];
    return data;
  }

  _listParts(key: string, uploadId: string): Promise<S3.ListPartsOutput> {
    const opts = { Bucket: this.bucketName, Key: key, UploadId: uploadId };
    return this.client.listParts(opts).promise();
  }

  private _listMultipartUploads(): Promise<S3.ListMultipartUploadsOutput> {
    return this.client.listMultipartUploads({ Bucket: this.bucketName }).promise();
  }

  private _complete(key: string, meta: S3Meta): Promise<any> {
    return this.client
      .completeMultipartUpload({
        Bucket: this.bucketName,
        Key: key,
        UploadId: meta.UploadId,
        MultipartUpload: {
          Parts: meta.Parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber }))
        }
      })
      .promise();
  }

  private _checkIfBucketExist(): Promise<any> {
    return this.client.headBucket({ Bucket: this.bucketName }).promise();
  }

  private async _getMeta(key: string): Promise<S3Meta> {
    const { Metadata } = await this.client
      .headObject({ Bucket: this.bucketName, Key: key + META_SUFFIX })
      .promise();
    if (Metadata) {
      const file: S3Meta = JSON.parse(decodeURIComponent(Metadata.metadata));
      const { Parts } = await this._listParts(key, file?.UploadId);
      file.Parts = Parts || [];
      file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce(
        (prev, next) => prev + next,
        0
      );
      this.metaStore[key] = file;
      return file;
    }
    return fail(ERRORS.FILE_NOT_FOUND);
  }
}
