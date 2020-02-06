import { AbortController } from 'abort-controller';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import request from 'node-fetch';
import { ERRORS, fail, getHeader, noop } from '../utils';
import { File, FileInit, FilePart, extractOriginalName, hasContent } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

const BUCKET_NAME = 'node-uploadx';

const uploadAPI = `https://storage.googleapis.com/upload/storage/v1/b`;
const storageAPI = `https://storage.googleapis.com/storage/v1/b`;
const authScopes = ['https://www.googleapis.com/auth/devstorage.full_control'];

export function getRangeEnd(range: string): number {
  const end = +range.split(/0-/)[1];
  return end > 0 ? end + 1 : 0;
}

export function buildContentRange(part: FilePart & GCSFile): string {
  if (hasContent(part)) {
    const end = part.contentLength ? part.start + part.contentLength - 1 : '*';
    return `bytes ${part.start}-${end}/${part.size ?? '*'}`;
  } else {
    return `bytes */${part.size ?? '*'}`;
  }
}
const validateStatus: (code: number) => boolean = (code: number) =>
  (code >= 200 && code < 300) || code === 308 || code === 499;

export type GCStorageOptions = BaseStorageOptions<GCSFile> &
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
  private cache: Record<string, GCSFile> = {};

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
    file.name = this.namingFunction(file);
    try {
      const existing = await this._getMeta(file.name);
      existing.bytesWritten = await this._write(existing);
      return existing;
    } catch {}
    const origin = getHeader(req, 'origin');
    const headers = { 'Content-Type': 'application/json; charset=utf-8' } as any;
    headers['X-Upload-Content-Length'] = file.size.toString();
    headers['X-Upload-Content-Type'] = file.contentType;
    origin && (headers['Origin'] = origin);
    const opts = {
      body: JSON.stringify({ metadata: file.metadata }),
      headers,
      method: 'POST' as 'POST',
      params: { name: file.name, size: file.size, uploadType: 'resumable' },
      url: this.uploadBaseURI
    };
    const res = await this.authClient.request(opts);
    file.uri = res.headers.location;
    if (this.config.clientDirectUpload) {
      file.GCSUploadURI = res.headers.location;
      this.log('send upload url to client: %s', file.GCSUploadURI);
      file.status = 'created';
      return file;
    }
    await this._saveMeta(file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<GCSFile> {
    const file = await this._getMeta(part.name);
    file.bytesWritten = await this._write({ ...file, ...part });
    file.status = this.setStatus(file);
    if (file.status === 'completed') {
      file.uri = `${this.storageBaseURI}/${file.name}`;
      await Promise.all([this._onComplete(file), this.onComplete(file)]);
    }
    return file;
  }

  _onComplete = (file: GCSFile): Promise<any> => {
    return this._deleteMeta(file.name);
  };

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
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file);
    return file;
  }

  async _write(part: FilePart & GCSFile): Promise<number> {
    const { size, uri, body } = part;
    const contentRange = buildContentRange(part);
    const options: any = { method: 'PUT' };
    if (body?.on) {
      const abortController = new AbortController();
      body.on('aborted', _ => abortController.abort());
      options.body = body;
      options.signal = abortController.signal;
    }
    options.headers = { 'Content-Range': contentRange, Accept: 'application/json' };
    try {
      const res = await request(uri, options);
      if (res.status === 308) {
        const range = res.headers.get('range');
        return range ? getRangeEnd(range) : 0;
      } else if (res.ok) {
        const data = await res.json();
        this.log('uploaded %o', data);
        return size;
      }
      const message = await res.text();
      return Promise.reject({ message, code: res.status });
    } catch (error) {
      this.log(error.message);
      return NaN;
    }
  }

  private async _saveMeta(file: GCSFile): Promise<any> {
    const name = file.name;
    await this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: this.metaName(name), uploadType: 'media' },
      url: this.uploadBaseURI
    });
    this.cache[name] = file;
    return file;
  }

  private async _getMeta(name: string): Promise<GCSFile> {
    const file = this.cache[name];
    if (file) return file;
    try {
      const url = `${this.storageBaseURI}/${this.metaName(name)}`;
      const { data } = await this.authClient.request<GCSFile>({ params: { alt: 'media' }, url });
      if (data?.name === name) {
        this.cache[name] = data;
        return data;
      }
    } catch (error) {}
    return fail(ERRORS.FILE_NOT_FOUND);
  }

  private async _deleteMeta(name: string): Promise<void> {
    const url = `${this.storageBaseURI}/${this.metaName(name)}`;
    try {
      await this.authClient.request({ method: 'DELETE', url });
    } catch {}
    delete this.cache[name];
  }

  private metaName(name: string): string {
    return `${encodeURIComponent(name)}${METAFILE_EXTNAME}`;
  }

  private async _checkBucket(bucketName: string): Promise<any> {
    this.isReady || (await this.authClient.request({ url: `${storageAPI}/${bucketName}` }));
  }
}
