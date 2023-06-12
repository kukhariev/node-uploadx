import {
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ClientConfig
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-providers';
import { File, MetaStorage, MetaStorageOptions, UploadList, toBoolean } from '@uploadx/core';

const BUCKET_NAME = 'node-uploadx';
export type S3MetaStorageOptions = S3ClientConfig &
  MetaStorageOptions & {
    bucket?: string;
    keyFile?: string;
  };

export class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
  bucket: string;
  client: S3Client;

  constructor(public config: S3MetaStorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && (config.credentials = fromIni({ configFilepath: keyFile }));
    const clientConfig = { ...config };
    clientConfig.logger = toBoolean(process.env.S3_DEBUG) ? this.logger : undefined;
    this.client = new S3Client(clientConfig);
  }

  async get(id: string): Promise<T> {
    const params = { Bucket: this.bucket, Key: this.getMetaName(id) };
    const { Metadata } = await this.client.send(new HeadObjectCommand(params));
    if (Metadata) {
      return JSON.parse(decodeURIComponent(Metadata.metadata)) as T;
    }
    return Promise.reject();
  }

  async delete(id: string): Promise<void> {
    const params = { Bucket: this.bucket, Key: this.getMetaName(id) };
    await this.client.send(new DeleteObjectCommand(params));
  }

  async save(id: string, file: T): Promise<T> {
    const metadata = encodeURIComponent(JSON.stringify(file));
    const params = {
      Bucket: this.bucket,
      Key: this.getMetaName(id),
      Metadata: { metadata },
      ContentLength: 0
    };
    await this.client.send(new PutObjectCommand(params));
    return file;
  }

  async list(prefix: string): Promise<UploadList> {
    const params = {
      Bucket: this.bucket,
      Prefix: this.prefix + prefix
    };
    const items = [];
    const response = await this.client.send(new ListObjectsV2Command(params));
    if (response.Contents?.length) {
      for (const { Key, LastModified } of response.Contents) {
        Key &&
          LastModified &&
          Key.endsWith(this.suffix) &&
          items.push({
            id: this.getIdFromMetaName(Key),
            createdAt: LastModified
          });
      }
    }
    return { items, prefix };
  }
}
