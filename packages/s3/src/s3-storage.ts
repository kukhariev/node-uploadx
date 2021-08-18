/* eslint-disable @typescript-eslint/naming-convention */

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
  MetaStorage,
  updateMetadata
} from '@uploadx/core';
import { AWSError, config as AWSConfig, S3 } from 'aws-sdk';
import * as http from 'http';
import { S3MetaStorage, S3MetaStorageOptions } from './s3-meta-storage';

const BUCKET_NAME = 'node-uploadx';

export class S3File extends File {
  Parts: S3.Parts = [];
  UploadId = '';
  uri?: string;
}

export type S3StorageOptions = BaseStorageOptions<S3File> &
  S3.ClientConfiguration & {
    /**
     * AWS S3 bucket
     * @defaultValue 'node-uploadx'
     */
    bucket?: string;
    keyFile?: string;
    metaStorageConfig?: LocalMetaStorageOptions | S3MetaStorageOptions;
  };

export class S3Storage extends BaseStorage<S3File> {
  bucket: string;
  client: S3;
  meta: MetaStorage<S3File>;

  constructor(public config: S3StorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && AWSConfig.loadFromPath(keyFile);
    this.client = new S3(config);
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
    if (error.statusCode || error.time) {
      return {
        message: error.message,
        code: error.code,
        statusCode: error.statusCode || 500,
        retryable: error.retryable,
        name: error.name
      };
    }
    return super.normalizeError(error);
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<S3File> {
    const file = new S3File(config);
    file.name = this.namingFunction(file);
    await this.validate(file);
    try {
      const existing = await this.getMeta(file.name);
      if (existing.bytesWritten >= 0) {
        return existing;
      }
    } catch {}

    const params: S3.CreateMultipartUploadRequest = {
      Bucket: this.bucket,
      Key: file.name,
      ContentType: file.contentType,
      Metadata: mapValues(file.metadata, encodeURI)
    };

    const { UploadId } = await this.client.createMultipartUpload(params).promise();
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
    if (file.status === 'completed') return file;
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);
    file.Parts ||= await this._getParts(file);
    file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce(
      (prev, next) => prev + next,
      0
    );
    this.cache.set(file.name, file);
    if (hasContent(part)) {
      const partNumber = file.Parts.length + 1;
      const params: S3.UploadPartRequest = {
        Bucket: this.bucket,
        Key: file.name,
        UploadId: file.UploadId,
        PartNumber: partNumber,
        Body: part.body,
        ContentLength: part.contentLength || 0
      };
      const { ETag } = await this.client.uploadPart(params).promise();
      const uploadPart: S3.Part = { PartNumber: partNumber, Size: part.contentLength, ETag };
      file.Parts = [...file.Parts, uploadPart];
      file.bytesWritten = +(part.contentLength || 0);
      this.cache.set(file.name, file);
    }
    if (isCompleted(file)) {
      const [completed] = await this._onComplete(file);
      file.uri = completed.Location;
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

  async update(name: string, { metadata }: Partial<File>): Promise<S3File> {
    const file = await this.getMeta(name);
    updateMetadata(file, metadata);
    await this.saveMeta(file);
    return { ...file, status: 'updated' };
  }

  protected _onComplete = (file: S3File): Promise<[S3.CompleteMultipartUploadOutput, any]> => {
    return Promise.all([this._complete(file), this.deleteMeta(file.name)]);
  };

  private async _getParts(file: S3File): Promise<S3.Parts> {
    const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
    const { Parts = [] } = await this.client.listParts(params).promise();
    return Parts;
  }

  private _complete(file: S3File): Promise<S3.CompleteMultipartUploadOutput> {
    const params = {
      Bucket: this.bucket,
      Key: file.name,
      UploadId: file.UploadId,
      MultipartUpload: {
        Parts: file.Parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber }))
      }
    };
    return this.client.completeMultipartUpload(params).promise();
  }

  private async _abortMultipartUpload(file: S3File): Promise<any> {
    if (file.status === 'completed') return;
    try {
      const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
      await this.client.abortMultipartUpload(params).promise();
    } catch (err) {
      this.log('_abortMultipartUploadError: ', err);
    }
  }

  private _checkBucket(): void {
    this.client.headBucket({ Bucket: this.bucket }, err => {
      if (err) {
        throw new Error(`Bucket code: ${err.code}`);
      }
      this.isReady = true;
      this.log.enabled && this._listMultipartUploads();
    });
  }

  private _listMultipartUploads(): void {
    this.client.listMultipartUploads({ Bucket: this.bucket }, (err, data) => {
      err && this.log('Incomplete Uploads fetch error:', err);
      data && this.log('Incomplete Uploads: ', data.Uploads?.length);
    });
  }
}
