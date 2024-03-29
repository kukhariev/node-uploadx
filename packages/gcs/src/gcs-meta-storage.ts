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

  /**
   * Returns metafile url
   * @param id - upload id
   */
  getMetaPath(id: string): string {
    return `${this.storageBaseURI}/${this.getMetaName(id)}`;
  }

  async save(id: string, file: T): Promise<T> {
    //TODO: use JSON API multipart POST?
    await this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: encodeURIComponent(this.getMetaName(id)), uploadType: 'media' },
      url: this.uploadBaseURI
    });
    return file;
  }

  async delete(id: string): Promise<void> {
    const url = this.getMetaPath(id);
    await this.authClient.request({ method: 'DELETE', url });
    return;
  }

  async get(id: string): Promise<T> {
    const url = this.getMetaPath(id);
    const { data } = await this.authClient.request<T>({ params: { alt: 'media' }, url });
    return data;
  }

  async list(prefix: string): Promise<UploadList> {
    const baseURL = this.storageBaseURI;
    const url = '/';
    const options = { baseURL, url, params: { prefix: encodeURIComponent(this.prefix + prefix) } };
    const { data } = await this.authClient.request<{
      items: { name: string; timeCreated: string; metadata?: T }[];
    }>(options);
    return {
      items: data.items
        .filter(item => item.name.endsWith(this.suffix))
        .map(({ name, timeCreated }) => ({
          id: this.getIdFromMetaName(name),
          createdAt: new Date(timeCreated)
        }))
    };
  }
}
