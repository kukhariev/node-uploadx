import { File, MetaStorage, MetaStorageOptions, UploadList } from '@uploadx/core';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import { GCSConfig } from './gcs-config';

export interface GCSMetaStorageOptions extends GoogleAuthOptions, MetaStorageOptions {
  bucket?: string;
}

export class GCSMetaStorage<T extends File = File> extends MetaStorage<T> {
  authClient: GoogleAuth;
  storageBaseURI: string;
  uploadBaseURI: string;

  constructor(readonly config: GCSMetaStorageOptions = {}) {
    super(config);
    config.keyFile ||= process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || GCSConfig.bucketName;
    this.storageBaseURI = [GCSConfig.storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseURI = [GCSConfig.uploadAPI, bucketName, 'o'].join('/');
    config.scopes ||= GCSConfig.authScopes;
    this.authClient = new GoogleAuth(config);
  }

  getMetaName = (name: string): string => this.prefix + name + this.suffix;

  /**
   * Returns metafile url
   * @param name upload name
   */
  getMetaPath(name: string): string {
    return `${this.storageBaseURI}/${this.getMetaName(name)}`;
  }

  /**
   * Returns upload name from metafile url
   * @internal
   */
  getNameFromPath = (metaFilePath: string): string =>
    metaFilePath.slice(`${this.prefix}`.length, -this.suffix.length);

  async save(name: string, file: T): Promise<T> {
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

  async delete(name: string): Promise<void> {
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
      items: { name: string; timeCreated: string; metadata?: T }[];
    }>(options);
    return {
      items: data.items
        .filter(item => item.name.endsWith(this.suffix))
        .map(({ name, timeCreated }) => ({
          name: this.getNameFromPath(name),
          createdAt: new Date(timeCreated)
        }))
    };
  }
}
