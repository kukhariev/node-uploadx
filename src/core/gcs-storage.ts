import { GaxiosOptions, request } from 'gaxios';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import { Readable } from 'stream';
import { ERRORS, fail, File, FilePart } from '.';
import { BaseStorage, BaseStorageOptions } from './storage';
import { getHeader } from './utils';

const PACKAGE_NAME = 'node-uploadx';
const META_SUFFIX = '.META';

const uploadAPI = `https://storage.googleapis.com/upload/storage/v1/b`;
const storageAPI = `https://www.googleapis.com/storage/v1/b`;
const authScopes = ['https://www.googleapis.com/auth/devstorage.full_control'];

function getRangeEnd(range = ''): number {
  const end = +range.split(/0-/)[1];
  return end >= 0 ? end : -1;
}

const defaultPath = ({ userId, id }: Partial<File>): string =>
  userId ? `${userId}/${id || ''}` : `${id}`;

const validateStatus: (code: number) => boolean = (code: number) =>
  (code >= 200 && code < 300) || code === 308 || code === 499;

export type GCStorageOptions = BaseStorageOptions &
  GoogleAuthOptions & {
    bucketName?: string;
    namingFunction?: (file: Partial<File>) => string;
  };

/**
 * Google cloud storage based backend.
 */
export class GCStorage extends BaseStorage {
  authClient: GoogleAuth;
  metaStore: Record<string, File> = {};
  storageBaseUri: string;
  uploadBaseUri: string;
  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: GCStorageOptions = {}) {
    super(config);
    config.scopes = config.scopes || authScopes;
    this.authClient = new GoogleAuth(config);
    const bucketName = config.bucketName || PACKAGE_NAME;
    this._getFileName = config.namingFunction || defaultPath;
    this.storageBaseUri = [storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseUri = [uploadAPI, bucketName, 'o'].join('/');
  }

  async create(req: http.IncomingMessage, file: File): Promise<File> {
    const errors = this.validate(file);
    if (errors.length) return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());

    const path = this._getFileName(file);
    const existing = this.metaStore[path] || (await this._getMeta(file).catch(err => {}));
    if (existing) return existing;

    const origin = getHeader(req, 'origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8' } as any;
    headers['X-Upload-Content-Length'] = file.size.toString();
    headers['X-Upload-Content-Type'] = file.mimeType || 'application/octet-stream';
    origin && (headers['Origin'] = origin);
    const res = await this.authClient.request({
      body: JSON.stringify({ metadata: file.metadata }),
      headers,
      method: 'POST',
      params: { name: path, size: file.size.toString(), uploadType: 'resumable' },
      url: this.uploadBaseUri
    });

    file.path = res.headers.location;
    await this._saveMeta(file, path);
    file.status = 'created';
    return file;
  }

  async write(stream: Readable, part: FilePart): Promise<File> {
    const file = await this._getMeta(part);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.bytesWritten = await this._write(stream, { ...file, ...part });
    if (file.status === 'deleted') {
      await this._deleteMeta(file);
      return file;
    }
    if (file.bytesWritten === file.size) {
      file.path = this._getFileName(file);
      await this._deleteMeta(file);
    }
    return file;
  }

  async delete(query: Partial<File>): Promise<File[]> {
    const file = await this._getMeta(query).catch(err => {});
    if (file) {
      await this.authClient.request({ method: 'DELETE', url: file.path, validateStatus });
      await this._deleteMeta(file);
      return [file];
    }
    return [query as File];
  }

  async get(query: Partial<File>): Promise<File[]> {
    const baseURL = this.storageBaseUri;
    let url = '/';
    if (query.id) {
      url = url + this._getFileName(query);
      const { data } = await this.authClient.request({ baseURL, url });
      return [data] as any;
    } else if (query.userId) {
      const options = { baseURL, url, params: { prefix: query.userId } };
      const { data } = await this.authClient.request(options);
      return [data] as any;
    }
    return [] as any;
  }

  async _write(body: Readable, file: FilePart): Promise<number> {
    const { start, end, size, path: url } = file;
    let range;
    if (start >= 0) {
      range = `bytes ${start ?? '*'}-${end ?? '*'}/${size ?? '*'}`;
    } else {
      `bytes */${size ?? '*'}`;
    }
    const options: GaxiosOptions = { body, method: 'PUT', retry: false, url, validateStatus };
    options.headers = {
      'Content-Range': range,
      'Content-Type': 'application/octet-stream'
    };
    const res = await request(options);
    if (res.status === 308) {
      return getRangeEnd(res.headers.range) + 1;
    } else {
      return size || 0;
    }
  }

  private _saveMeta(file: File, path: string): Promise<any> {
    this.metaStore[path] = file;
    return this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: path + META_SUFFIX, uploadType: 'media' },
      url: this.uploadBaseUri
    });
  }

  private async _getMeta(query: Partial<File>): Promise<File> {
    const path = this._getFileName(query);
    const file = this.metaStore[path];
    if (file) return file;
    const url = this.storageBaseUri + '/' + path + META_SUFFIX;
    const { data } = await this.authClient.request({ params: { alt: 'media' }, url });
    this.metaStore[path] = data;
    return data;
  }

  private async _deleteMeta(query: Partial<File>): Promise<any> {
    const path = this._getFileName(query);
    const url = this.storageBaseUri + '/' + path + META_SUFFIX;
    delete this.metaStore[path];
    try {
      return this.authClient.request({ method: 'DELETE', url });
    } catch {}
  }
}
