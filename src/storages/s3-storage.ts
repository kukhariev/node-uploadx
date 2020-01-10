import { S3, config as AWSConfig } from 'aws-sdk';
import * as http from 'http';
import { ERRORS, fail, noop } from '../utils';
import { extractOriginalName, File, FileInit, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

const BUCKET_NAME = 'node-uploadx';

export class S3File extends File {
  Parts: S3.Parts = [];
  UploadId = '';
}

export type S3StorageOptions = BaseStorageOptions &
  S3.ClientConfiguration & {
    /**
     * AWS S3 bucket
     * @defaultValue 'node-uploadx'
     */
    bucket?: string;
    keyFile?: string;
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
  private metaCache: Record<string, S3File> = {};

  constructor(public config: S3StorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && AWSConfig.loadFromPath(keyFile);
    this.client = new S3(config);
    this._checkBucket();
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<File> {
    const file = new S3File(config);
    await this.validate(file);
    const name = this.namingFunction(file);
    const existing = await this._getMeta(name).catch(noop);
    if (existing) return existing;
    const metadata = processMetadata(file.metadata, encodeURI);

    const multiPartOptions: S3.CreateMultipartUploadRequest = {
      Bucket: this.bucket,
      Key: name,
      ContentType: file.contentType,
      Metadata: metadata
    };

    const { UploadId } = await this.client.createMultipartUpload(multiPartOptions).promise();
    if (!UploadId) {
      return fail(ERRORS.FILE_ERROR, 's3 create multipart upload error');
    }
    file.UploadId = UploadId;
    file.name = name;
    await this._saveMeta(name, file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<File> {
    const file = await this._getMeta(part.name);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    if (Number(part.start) >= 0) {
      await this._write({ ...file, ...part });
    }
    if (file.bytesWritten === file.size) {
      const [completed] = await Promise.all([this._complete(file), this._deleteMetaFile(file)]);
      delete this.metaCache[file.name];
      file.uri = completed.Location;
    }
    return file;
  }

  async delete(name: string): Promise<File[]> {
    const file = await this._getMeta(name);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this._deleteMetaFile(file), this._abortMultipartUpload(file)]);
      delete this.metaCache[file.name];
    }
    return [{ name } as File];
  }

  async get(prefix: string): Promise<File[]> {
    const { Contents } = await this.client
      .listObjectsV2({ Bucket: this.bucket, Prefix: prefix })
      .promise();
    return Contents as any;
  }

  async update(name: string, { metadata }: Partial<File>): Promise<File> {
    const file = await this._getMeta(name);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file.name, file);
    return file;
  }

  async _write(file: S3File & FilePart): Promise<S3.UploadPartOutput> {
    const partNumber = (file.Parts || []).length + 1;
    const partOpts: S3.UploadPartRequest = {
      Bucket: this.bucket,
      Key: file.name,
      UploadId: file.UploadId,
      PartNumber: partNumber,
      Body: file.body,
      ContentLength: file.contentLength
    };
    const data: S3.UploadPartOutput = await this.client.uploadPart(partOpts).promise();
    if (file.status === 'deleted') {
      delete this.metaCache[file.name];
      return data;
    }
    const part: S3.Part = { ...data, ...{ PartNumber: partNumber, Size: file.contentLength } };
    this.metaCache[file.name].bytesWritten = file.bytesWritten + (file.contentLength || 0);
    this.metaCache[file.name].Parts = [...(file.Parts || []), part];
    return data;
  }

  private _listParts(key: string, uploadId: string): Promise<S3.ListPartsOutput> {
    const opts = { Bucket: this.bucket, Key: key, UploadId: uploadId };
    return this.client.listParts(opts).promise();
  }

  private _complete(meta: S3File): Promise<S3.CompleteMultipartUploadOutput> {
    return this.client
      .completeMultipartUpload({
        Bucket: this.bucket,
        Key: meta.name,
        UploadId: meta.UploadId,
        MultipartUpload: {
          Parts: meta.Parts.map(({ ETag, PartNumber }) => ({ ETag, PartNumber }))
        }
      })
      .promise();
  }

  private async _saveMeta(name: string, file: S3File): Promise<any> {
    const metadata = encodeURIComponent(JSON.stringify(file));
    await this.client
      .putObject({
        Bucket: this.bucket,
        Key: name + METAFILE_EXTNAME,
        Metadata: { metadata }
      })
      .promise();
    this.metaCache[name] = { ...file, ...{ Parts: [] } };
  }

  private async _getMeta(name: string): Promise<S3File | undefined> {
    let file: S3File = this.metaCache[name];
    if (file) return file;
    const { Metadata } = await this.client
      .headObject({ Bucket: this.bucket, Key: name + METAFILE_EXTNAME })
      .promise();
    if (Metadata) {
      file = JSON.parse(decodeURIComponent(Metadata.metadata));
      const { Parts } = await this._listParts(name, file?.UploadId);
      file.Parts = Parts || [];
      file.bytesWritten = file.Parts.map(item => item.Size || 0).reduce(
        (prev, next) => prev + next,
        0
      );
      this.metaCache[name] = file;
      return file;
    }
    return;
  }

  private async _deleteMetaFile(file: S3File): Promise<any> {
    await this.client
      .deleteObject({ Bucket: this.bucket, Key: file.name + METAFILE_EXTNAME })
      .promise()
      .catch(noop);
  }

  private async _abortMultipartUpload(file: S3File): Promise<any> {
    const params = { Bucket: this.bucket, Key: file.name, UploadId: file.UploadId };
    await this.client
      .abortMultipartUpload(params)
      .promise()
      .catch(noop);
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
