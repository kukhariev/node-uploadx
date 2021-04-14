/* eslint-disable @typescript-eslint/naming-convention */
import {
  BaseStorage,
  BaseStorageOptions,
  ERRORS,
  extractOriginalName,
  fail,
  File,
  FileInit,
  FilePart,
  hasContent,
  METAFILE_EXTNAME,
  mapValues
} from '@uploadx/core';
import { config as AWSConfig, S3 } from 'aws-sdk';
import * as http from 'http';

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
  };

export interface S3ListObject {
  name?: string;

  updated?: any;
}

export class S3Storage extends BaseStorage<S3File, any> {
  bucket: string;
  client: S3;

  constructor(public config: S3StorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && AWSConfig.loadFromPath(keyFile);
    this.client = new S3(config);
    this._checkBucket();
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<S3File> {
    const file = new S3File(config);
    await this.validate(file);
    file.name = this.namingFunction(file);
    try {
      const existing = await this._getMeta(file.name);
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
    await this._saveMeta(file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<S3File> {
    const file = await this._getMeta(part.name);
    file.Parts ||= [];
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
    file.status = this.setStatus(file);
    if (file.status === 'completed') {
      const [completed] = await this._onComplete(file);
      file.uri = completed.Location;
    }
    return file;
  }

  async delete(name: string): Promise<S3File[]> {
    const file = await this._getMeta(name).catch(() => null);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this._deleteMeta(file.name), this._abortMultipartUpload(file)]);
      return [{ ...file }];
    }
    return [{ name } as S3File];
  }

  async get(prefix = ''): Promise<S3ListObject[]> {
    const re = new RegExp(`${METAFILE_EXTNAME}$`);
    const params = { Bucket: this.bucket, Prefix: prefix };
    const { Contents } = await this.client.listObjectsV2(params).promise();
    if (Contents?.length) {
      return Contents.filter(item =>
        item.Key?.endsWith(METAFILE_EXTNAME)
      ).map(({ Key, LastModified }) => ({ name: Key?.replace(re, ''), updated: LastModified }));
    }
    return [];
  }

  async update(name: string, { metadata }: Partial<File>): Promise<S3File> {
    const file = await this._getMeta(name);
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file);
    return file;
  }

  protected async _saveMeta(file: S3File): Promise<any> {
    const metadata = encodeURIComponent(JSON.stringify(file));
    const params = {
      Bucket: this.bucket,
      Key: file.name + METAFILE_EXTNAME,
      Metadata: { metadata }
    };
    await this.client.putObject(params).promise();
    this.cache.set(file.name, file);
  }

  protected async _getMeta(name: string): Promise<S3File> {
    let file = this.cache.get(name);
    if (file) return file;
    try {
      const params = { Bucket: this.bucket, Key: name + METAFILE_EXTNAME };
      const { Metadata } = await this.client.headObject(params).promise();
      if (Metadata) {
        const data: S3File = JSON.parse(decodeURIComponent(Metadata.metadata)) as S3File;
        const uploaded = await this._getParts(data);
        file = { ...data, ...uploaded };
        this.cache.set(name, file);
        return file;
      }
    } catch {}
    return fail(ERRORS.FILE_NOT_FOUND);
  }

  protected async _deleteMeta(name: string): Promise<void> {
    this.cache.delete(name);
    const params = { Bucket: this.bucket, Key: name + METAFILE_EXTNAME };
    await this.client
      .deleteObject(params)
      .promise()
      .catch(() => null);
  }

  protected _onComplete = (file: S3File): Promise<[S3.CompleteMultipartUploadOutput, any]> => {
    return Promise.all([this._complete(file), this._deleteMeta(file.name)]);
  };

  private async _getParts(file: S3File): Promise<{ bytesWritten: number; Parts: S3.Parts }> {
    const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
    const { Parts = [] } = await this.client.listParts(params).promise();
    const bytesWritten = Parts.map(item => item.Size || 0).reduce((prev, next) => prev + next, 0);
    return { bytesWritten, Parts };
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
