import { AbortController } from 'abort-controller';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import request from 'node-fetch';
import { callbackify } from 'util';
import { ERRORS, fail, getHeader, logger, noop } from '../utils';
import { File, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, DEFAULT_FILENAME } from './storage';

const log = logger.extend('GCStorage');

const BUCKET_NAME = 'node-uploadx';
const META = '.META';

const uploadAPI = `https://storage.googleapis.com/upload/storage/v1/b`;
const storageAPI = `https://storage.googleapis.com/storage/v1/b`;
const authScopes = ['https://www.googleapis.com/auth/devstorage.full_control'];

function getRangeEnd(range: any = ''): number {
  const end = +range.split(/0-/)[1];
  return end >= 0 ? end : -1;
}

const validateStatus: (code: number) => boolean = (code: number) =>
  (code >= 200 && code < 300) || code === 308 || code === 499;

export type GCStorageOptions = BaseStorageOptions &
  GoogleAuthOptions & {
    /**
     * Google Cloud Storage bucket
     * @defaultValue 'node-uploadx'
     */
    bucket?: string;
  };
export interface GCSFile extends File {
  uploadURI: string;
}
/**
 * Google cloud storage based backend.
 */
export class GCStorage extends BaseStorage {
  authClient: GoogleAuth;
  metaStore: Record<string, GCSFile> = {};
  storageBaseURI: string;
  uploadBaseURI: string;
  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: GCStorageOptions = {}) {
    super(config);
    config.scopes = config.scopes || authScopes;
    config.keyFile = config.keyFile || process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || BUCKET_NAME;
    this._getFileName = config.filename || DEFAULT_FILENAME;
    this.storageBaseURI = [storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseURI = [uploadAPI, bucketName, 'o'].join('/');
    this.authClient = new GoogleAuth(config);
    const checkBucket = callbackify(this._checkBucket.bind(this));
    checkBucket(bucketName, err => {
      if (err) {
        throw new Error(`Bucket code: ${err.code}`);
      }
      this.isReady = true;
    });
  }

  async create(req: http.IncomingMessage, file: GCSFile): Promise<File> {
    const errors = this.validate(file);
    if (errors.length) return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());

    const path = this._getFileName(file);
    // const existing = this.metaStore[path] || (await this._getMeta(path).catch(noop));
    // if (existing) return existing;

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
      url: this.uploadBaseURI
    });

    file.path = path;
    file.uploadURI = res.headers.location;
    await this._saveMeta(path, file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<File> {
    const file = await this._getMeta(part.path);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.bytesWritten = await this._write({ ...file, ...part });
    if (file.status === 'deleted' || file.bytesWritten === file.size) {
      await this._deleteMeta(file.path);
      return file;
    }
    return file;
  }

  async delete(path: string): Promise<File[]> {
    const file = await this._getMeta(path).catch(noop);
    if (file) {
      await this.authClient.request({ method: 'DELETE', url: file.uploadURI, validateStatus });
      await this._deleteMeta(file.path);
      return [file];
    }
    return [{ path } as File];
  }

  async get(prefix: string): Promise<File[]> {
    const baseURL = this.storageBaseURI;
    const url = '/';
    const options = { baseURL, url, params: { prefix } };
    const { data } = await this.authClient.request(options);
    return [data] as any;
  }

  async _write(file: GCSFile & FilePart): Promise<number> {
    const { start, size, contentLength, uploadURI: url, body } = file;
    let range;
    if (typeof start === 'number') {
      // if (typeof start === 'number' && start >= 0) {
      const end = contentLength ? start + contentLength - 1 : '*';
      range = `bytes ${start}-${end}/${size ?? '*'}`;
    } else {
      range = `bytes */${size ?? '*'}`;
    }
    const abortCtrl = new AbortController();
    const signal = abortCtrl.signal;
    body?.on('aborted', _ => abortCtrl.abort());
    const options: any = { body, method: 'PUT', signal };
    options.headers = {
      'Content-Range': range,
      'Content-Type': 'application/octet-stream',
      Accept: 'application/json'
    };
    try {
      const res = await request(url, options);
      if (res.status === 308) {
        return getRangeEnd(res.headers.get('range')) + 1;
      } else if (res.ok) {
        const message = await res.json();
        log('%o', message);
        return size || 0;
      }
      const message = await res.json();
      return Promise.reject(message);
    } catch (error) {
      log(error.message);
      return null as any;
    }
  }

  private _saveMeta(path: string, file: GCSFile): Promise<any> {
    const name = encodeURIComponent(path);
    this.metaStore[name] = file;
    return this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: `${file.path}${META}`, uploadType: 'media' },
      url: this.uploadBaseURI
    });
  }

  private async _getMeta(path: string): Promise<GCSFile> {
    const name = encodeURIComponent(path);
    const file = this.metaStore[name];
    if (file) return file;
    const url = `${this.storageBaseURI}/${name}${META}`;
    const { data } = await this.authClient.request({ params: { alt: 'media' }, url });
    this.metaStore[name] = data;
    return data;
  }

  private _deleteMeta(path: string): Promise<any> {
    const name = encodeURIComponent(path);
    const url = `${this.storageBaseURI}/${name}${META}`;
    delete this.metaStore[name];
    return this.authClient.request({ method: 'DELETE', url }).catch(err => console.warn(err));
  }

  private _checkBucket(bucketName: string): Promise<any> {
    return this.authClient.request({ url: `${storageAPI}/${bucketName}` });
  }
}
