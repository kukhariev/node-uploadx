import { File, UploadList, MetaStorage, MetaStorageOptions } from '@uploadx/core';
import { config as AWSConfig, S3 } from 'aws-sdk';

const BUCKET_NAME = 'node-uploadx';
export interface S3MetaStorageOptions extends S3.ClientConfiguration, MetaStorageOptions {
  bucket?: string;
  keyFile?: string;
}

export class S3MetaStorage<T extends File = File> extends MetaStorage<T> {
  bucket: string;
  client: S3;

  constructor(readonly config: S3MetaStorageOptions) {
    super(config);
    this.bucket = config.bucket || process.env.S3_BUCKET || BUCKET_NAME;
    const keyFile = config.keyFile || process.env.S3_KEYFILE;
    keyFile && AWSConfig.loadFromPath(keyFile);
    this.client = new S3(config);
    this.prefix = config?.prefix ?? '';
  }

  getMetaName(name: string): string {
    return this.prefix + name + this.suffix;
  }

  async get(name: string): Promise<T> {
    const params = { Bucket: this.bucket, Key: this.getMetaName(name) };
    const { Metadata } = await this.client.headObject(params).promise();
    if (Metadata) {
      return JSON.parse(decodeURIComponent(Metadata.metadata)) as T;
    }
    return Promise.reject();
  }

  async delete(name: string): Promise<void> {
    const params = { Bucket: this.bucket, Key: this.getMetaName(name) };
    await this.client
      .deleteObject(params)
      .promise()
      .catch(() => null);
  }

  async save(name: string, file: T): Promise<T> {
    const metadata = encodeURIComponent(JSON.stringify(file));
    const params = {
      Bucket: this.bucket,
      Key: this.getMetaName(name),
      Metadata: { metadata }
    };
    await this.client.putObject(params).promise();
    return file;
  }

  async list(prefix: string): Promise<UploadList> {
    const params: S3.ListObjectsV2Request = {
      Bucket: this.bucket,
      Prefix: prefix
      // Delimiter: this.suffix
    };
    const items = [];
    const response = await this.client.listObjectsV2(params).promise();
    if (response.Contents?.length) {
      for (const { Key, LastModified } of response.Contents) {
        Key &&
          LastModified &&
          Key.endsWith(this.suffix) &&
          items.push({
            name: Key?.slice(this.prefix.length, -this.suffix.length),
            created: LastModified
          });
      }
    }
    return { items };
  }
}
