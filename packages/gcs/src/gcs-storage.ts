import {
  BaseStorage,
  BaseStorageOptions,
  ERRORS,
  fail,
  File,
  FileInit,
  FilePart,
  getHeader,
  hasContent,
  HttpError,
  isValidPart,
  METAFILE_EXTNAME,
  updateMetadata,
  updateStatus
} from '@uploadx/core';
import { AbortController } from 'abort-controller';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import request from 'node-fetch';

export interface ClientError extends Error {
  code: string;
  response?: Record<string, any>;
  config: Record<string, any>;
}

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

const validateStatus = (code: number): boolean =>
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

  constructor(public config: GCStorageOptions = {}) {
    super(config);
    config.scopes ||= authScopes;
    config.keyFile ||= process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || BUCKET_NAME;
    this.storageBaseURI = [storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseURI = [uploadAPI, bucketName, 'o'].join('/');
    this.authClient = new GoogleAuth(config);
    this._checkBucket(bucketName)
      .then(() => (this.isReady = true))
      .catch((err: ClientError) => {
        // eslint-disable-next-line no-console
        console.error('error open bucket: %o', err);
        process.exit(1);
      });
  }

  normalizeError(error: ClientError): HttpError {
    const status = +error.code || 500;
    if (error.config) {
      return {
        message: error.message,
        code: error.code,
        statusCode: status,
        name: error.name,
        retryable: status >= 499
      };
    }
    return super.normalizeError(error);
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<GCSFile> {
    const file = new GCSFile(config);
    file.name = this.namingFunction(file);
    await this.validate(file);
    try {
      const existing = await this._getMeta(file.name);
      existing.bytesWritten = await this._write(existing);
      return existing;
    } catch {}
    const origin = getHeader(req, 'origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8' };
    headers['X-Upload-Content-Length'] = file.size.toString();
    headers['X-Upload-Content-Type'] = file.contentType;
    origin && (headers['Origin'] = origin);
    const opts = {
      body: JSON.stringify({ metadata: file.metadata }),
      headers,
      method: 'POST' as const,
      params: { name: file.name, size: file.size, uploadType: 'resumable' },
      url: this.uploadBaseURI
    };
    const res = await this.authClient.request(opts);
    file.uri = res.headers.location as string;
    if (this.config.clientDirectUpload) {
      file.GCSUploadURI = file.uri;
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
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);
    file.bytesWritten = await this._write({ ...file, ...part });
    updateStatus(file);
    if (file.status === 'completed') {
      file.uri = `${this.storageBaseURI}/${file.name}`;
      await this._onComplete(file);
    }
    return file;
  }

  async delete(name: string): Promise<GCSFile[]> {
    const file = await this._getMeta(name).catch(() => null);
    if (file?.uri) {
      file.status = 'deleted';
      const opts = { method: 'DELETE' as const, url: file.uri, validateStatus };
      await Promise.all([this.authClient.request(opts), this._deleteMeta(file.name)]);
      return [{ ...file }];
    }
    return [{ name } as GCSFile];
  }

  async get(prefix = ''): Promise<CGSObject[]> {
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
    updateMetadata(file, metadata);
    await this._saveMeta(file);
    return { ...file, status: 'updated' };
  }

  protected async _write(part: FilePart & GCSFile): Promise<number> {
    const { size, uri, body } = part;
    const contentRange = buildContentRange(part);
    const options: Record<string, any> = { method: 'PUT' };
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
        const data = (await res.json()) as Record<string, any>;
        this.log('uploaded %o', data);
        return size;
      }
      const message = await res.text();
      return Promise.reject({
        message,
        code: `${res.status}`,
        config: { uri },
        name: 'FetchError'
      });
    } catch (err) {
      this.log(uri, err);
      return NaN;
    }
  }

  protected async _saveMeta(file: GCSFile): Promise<GCSFile> {
    const name = file.name;
    await this.authClient.request({
      body: JSON.stringify(file),
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      method: 'POST',
      params: { name: this.metaName(name), uploadType: 'media' },
      url: this.uploadBaseURI
    });
    this.cache.set(name, file);
    return file;
  }

  protected async _getMeta(name: string): Promise<GCSFile> {
    const file = this.cache.get(name);
    if (file?.uri) return file;
    try {
      const url = `${this.storageBaseURI}/${this.metaName(name)}`;
      const { data } = await this.authClient.request<GCSFile>({ params: { alt: 'media' }, url });
      if (data?.name === name) {
        this.cache.set(name, data);
        return data;
      }
    } catch {}
    return fail(ERRORS.FILE_NOT_FOUND);
  }

  protected async _deleteMeta(name: string): Promise<void> {
    const url = `${this.storageBaseURI}/${this.metaName(name)}`;
    this.cache.delete(name);
    try {
      await this.authClient.request({ method: 'DELETE', url });
    } catch (err) {
      this.log('_deleteMetaError: ', err);
    }
  }

  private _onComplete = (file: GCSFile): Promise<any> => {
    return this._deleteMeta(file.name);
  };

  private metaName(name: string): string {
    return `${encodeURIComponent(name)}${METAFILE_EXTNAME}`;
  }

  private async _checkBucket(bucketName: string): Promise<any> {
    this.isReady || (await this.authClient.request({ url: `${storageAPI}/${bucketName}` }));
  }
}
