import { AbortController } from 'abort-controller';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import request from 'node-fetch';
import { ERRORS, fail, getHeader, noop } from '../utils';
import { File, FileInit, FilePart, extractOriginalName } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

const BUCKET_NAME = 'node-uploadx';

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
    /**
     * Force compatible client upload directly to GCS
     */
    clientDirectUpload?: boolean;
  };
export class GCSFile extends File {
  GCSUploadURI?: string;
  uri = '';
}

interface CGSObject {
  name: string;
  updated: Date;
}
/**
 * Google cloud storage based backend.
 */
export class GCStorage extends BaseStorage<GCSFile, CGSObject> {
  authClient: GoogleAuth;

  storageBaseURI: string;
  uploadBaseURI: string;
  private metaCache: Record<string, GCSFile> = {};

  constructor(public config: GCStorageOptions = {}) {
    super(config);
    config.scopes = config.scopes || authScopes;
    config.keyFile = config.keyFile || process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || BUCKET_NAME;
    this.storageBaseURI = [storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseURI = [uploadAPI, bucketName, 'o'].join('/');
    this.authClient = new GoogleAuth(config);
    this._checkBucket(bucketName)
      .then(() => (this.isReady = true))
      .catch(error => {
        throw new Error(`Bucket code: ${error.code}`);
      });
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<GCSFile> {
    const file = new GCSFile(config);
    await this.validate(file);
    const name = this.namingFunction(file);
    const existing = await this._getMeta(name).catch(noop);
    if (existing) return existing;

    const origin = getHeader(req, 'origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8' } as any;
    headers['X-Upload-Content-Length'] = file.size.toString();
    headers['X-Upload-Content-Type'] = file.contentType || 'application/octet-stream';
    origin && (headers['Origin'] = origin);
    const res = await this.authClient.request({
      body: JSON.stringify({ metadata: file.metadata }),
      headers,
      method: 'POST',
      params: { name, size: file.size, uploadType: 'resumable' },
      url: this.uploadBaseURI
    });

    file.name = name;
    file.uri = res.headers.location;
    if (this.config.clientDirectUpload) {
      file.GCSUploadURI = res.headers.location;
      this.log('send upload url to client: %s', file.GCSUploadURI);
      file.status = 'created';
      return file;
    }
    await this._saveMeta(name, file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<GCSFile> {
    const file = await this._getMeta(part.name);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.bytesWritten = await this._write({ ...file, ...part });
    // fixme:  delete
    file.status = this.setStatus(file);
    if (file.status === 'completed') {
      await this._deleteMeta(file.name);
      file.uri = `${this.storageBaseURI}/${file.name}`;
    }
    return file;
  }

  async delete(name: string): Promise<GCSFile[]> {
    const file: GCSFile = await this._getMeta(name).catch(noop);
    if (file) {
      await this.authClient.request({ method: 'DELETE', url: file.uri, validateStatus });
      await this._deleteMeta(file.name);
      file.status = 'deleted';
      return [{ ...file, name }];
    }
    return [{ name } as GCSFile];
  }

  async get(prefix: string): Promise<CGSObject[]> {
    const re = new RegExp(`${METAFILE_EXTNAME}$`);
    const baseURL = this.storageBaseURI;
    const url = '/';
    const options = { baseURL, url, params: { prefix } };
    const { data } = await this.authClient.request<{ items: CGSObject[] }>(options);
    return data.items
      .filter(item => item.name.endsWith(METAFILE_EXTNAME))
      .map(({ name, updated }) => ({ name: name.replace(re, ''), updated }));
  }

  async update(name: string, { metadata }: Partial<File>): Promise<GCSFile> {
    const file = await this._getMeta(name);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file.name, file);
    return file;
  }

  async _write(file: GCSFile & FilePart): Promise<number> {
    const { start, size, contentLength, uri: url, body } = file;
    const abortCtrl = new AbortController();
    const signal = abortCtrl.signal;
    body?.on('aborted', _ => abortCtrl.abort());
    let range;
    if (typeof start === 'number' && start >= 0) {
      const end = contentLength ? start + contentLength - 1 : '*';
      range = `bytes ${start}-${end}/${size ?? '*'}`;
    } else {
      range = `bytes */${size ?? '*'}`;
    }
    const options: any = { body, method: 'PUT', signal };
    options.headers = { 'Content-Range': range, Accept: 'application/json' };
    try {
      const res = await request(url, options);
      if (res.status === 308) {
        return getRangeEnd(res.headers.get('range')) + 1;
      } else if (res.ok) {
        const data = await res.json();
        this.log('uploaded %o', data);
        return data?.mediaLink ? size : NaN;
      }
      const message = await res.text();
      return Promise.reject({ message, code: res.status });
    } catch (error) {
      this.log(error.message);
      return null as any;
    }
  }

  private _saveMeta(path: string, file: GCSFile): Promise<any> {
    const name = encodeURIComponent(path);
    this.metaCache[name] = file;
    return this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: `${file.name}${METAFILE_EXTNAME}`, uploadType: 'media' },
      url: this.uploadBaseURI
    });
  }

  private async _getMeta(path: string): Promise<GCSFile | undefined> {
    const name = encodeURIComponent(path);
    const file = this.metaCache[name];
    if (file) return file;
    const url = `${this.storageBaseURI}/${name}${METAFILE_EXTNAME}`;
    const { data } = await this.authClient.request<GCSFile>({ params: { alt: 'media' }, url });
    this.metaCache[name] = data;
    return data;
  }

  private _deleteMeta(path: string): Promise<any> {
    const name = encodeURIComponent(path);
    const url = `${this.storageBaseURI}/${name}${METAFILE_EXTNAME}`;
    delete this.metaCache[name];
    return this.authClient.request({ method: 'DELETE', url }).catch(err => this.log(err));
  }

  private _checkBucket(bucketName: string): Promise<any> {
    return this.authClient.request({ url: `${storageAPI}/${bucketName}` });
  }
}
