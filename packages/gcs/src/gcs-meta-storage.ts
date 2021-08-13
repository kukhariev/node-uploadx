import { File, UploadList, MetaStorage } from '@uploadx/core';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import { authScopes, BUCKET_NAME, storageAPI, uploadAPI } from './constants';

export type GCSMetaStorageOptions = GoogleAuthOptions & {
  bucket?: string;
  prefix?: string;
  suffix?: string;
};

export class GCSMetaStorage<T extends File = File> extends MetaStorage<T> {
  authClient: GoogleAuth;
  storageBaseURI: string;
  uploadBaseURI: string;

  constructor(readonly config: GCSMetaStorageOptions = {}) {
    super();
    config.scopes ||= authScopes;
    config.keyFile ||= process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || BUCKET_NAME;
    this.storageBaseURI = [storageAPI, bucketName, 'o'].join('/');
    this.authClient = new GoogleAuth(config);
    this.uploadBaseURI = [uploadAPI, bucketName, 'o'].join('/');
  }

  getMetaName = (name: string): string => this.prefix + name + this.suffix;

  getMetaPath(name: string): string {
    return `${this.storageBaseURI}/${this.getMetaName(name)}`;
  }

  getNameFromPath = (metaFilePath: string): string =>
    metaFilePath.slice(`${this.prefix}`.length, -this.suffix.length);

  async set(name: string, file: T): Promise<T> {
    //TODO: use JSON API multipart POST?
    await this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: encodeURIComponent(this.getMetaName(name)), uploadType: 'media' },
      url: this.uploadBaseURI
    });
    return file;
  }

  async remove(name: string): Promise<void> {
    const url = this.getMetaPath(name);
    await this.authClient.request({ method: 'DELETE', url });
    return;
  }

  async get(name: string): Promise<T> {
    const url = this.getMetaPath(name);
    const { data } = await this.authClient.request<T>({ params: { alt: 'media' }, url });
    return data;
  }

  async list(prefix: string): Promise<UploadList> {
    const baseURL = this.storageBaseURI;
    const url = '/';
    const options = { baseURL, url, params: { prefix: encodeURIComponent(prefix) } };
    const { data } = await this.authClient.request<{
      items: { name: string; updated: Date; metadata: T }[];
    }>(options);
    return {
      items: data.items
        .filter(item => item.name.endsWith(this.suffix))
        .map(({ name, updated }) => ({ name: this.getNameFromPath(name), updated }))
    };
  }
}
