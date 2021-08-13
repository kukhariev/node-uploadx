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
  isCompleted,
  isValidPart,
  ListObject,
  LocalMetaStorage,
  MetaStorage,
  updateMetadata
} from '@uploadx/core';
import { AbortController } from 'abort-controller';
import { GoogleAuth, GoogleAuthOptions } from 'google-auth-library';
import * as http from 'http';
import request from 'node-fetch';
import { authScopes, BUCKET_NAME, storageAPI, uploadAPI } from './constants';
import { GCSMetaStorage } from './gcs-meta-storage';

export interface ClientError extends Error {
  code: string;
  response?: Record<string, any>;
  config: Record<string, any>;
}

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

type CGSListObject = ListObject;

/**
 * Google cloud storage based backend.
 */
export class GCStorage extends BaseStorage<GCSFile, CGSListObject> {
  authClient: GoogleAuth;
  storageBaseURI: string;
  uploadBaseURI: string;
  meta: MetaStorage<GCSFile>;

  constructor(public config: GCStorageOptions = {}) {
    super(config);
    if (config.metaStorage) {
      this.meta = config.metaStorage;
    } else {
      this.meta =
        typeof config.metaStoragePath === 'string'
          ? new LocalMetaStorage({ directory: config.metaStoragePath })
          : new GCSMetaStorage(config);
    }
    config.scopes ||= authScopes;
    config.keyFile ||= process.env.GCS_KEYFILE;
    const bucketName = config.bucket || process.env.GCS_BUCKET || BUCKET_NAME;
    this.storageBaseURI = [storageAPI, bucketName, 'o'].join('/');
    this.uploadBaseURI = [uploadAPI, bucketName, 'o'].join('/');
    this.authClient = new GoogleAuth(config);
    this._checkBucket(bucketName);
  }

  normalizeError(error: ClientError): HttpError {
    const statusCode = +error.code || 500;
    if (error.config) {
      return {
        message: error.message,
        code: `GCS${statusCode}`,
        statusCode,
        name: error.name,
        retryable: statusCode >= 499
      };
    }
    return super.normalizeError(error);
  }

  async create(req: http.IncomingMessage, config: FileInit): Promise<GCSFile> {
    const file = new GCSFile(config);
    file.name = this.namingFunction(file);
    await this.validate(file);
    try {
      const existing = await this.getMetaFile(file.name);
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
      this.log('send uploadURI to client: %s', file.GCSUploadURI);
      file.status = 'created';
      return file;
    }
    await this.saveMetaFile(file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<GCSFile> {
    const file = await this.getMetaFile(part.name);
    if (file.status === 'completed') return file;
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);
    file.bytesWritten = await this._write({ ...file, ...part });
    if (isCompleted(file)) {
      file.uri = `${this.storageBaseURI}/${file.name}`;
      await this._onComplete(file);
    }
    return file;
  }

  async delete(name: string): Promise<GCSFile[]> {
    const file = await this.getMetaFile(name).catch(() => null);
    if (file?.uri) {
      file.status = 'deleted';
      await Promise.all([
        this.authClient.request({ method: 'DELETE' as const, url: file.uri, validateStatus }),
        this.deleteMetaFile(file.name)
      ]);
      return [{ ...file }];
    }
    return [{ name } as GCSFile];
  }

  async get(prefix = ''): Promise<CGSListObject[]> {
    return this.meta.list(prefix);
  }

  async update(name: string, { metadata }: Partial<File>): Promise<GCSFile> {
    const file = await this.getMetaFile(name);
    updateMetadata(file, metadata);
    await this.saveMetaFile(file);
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
        code: `GCS${res.status}`,
        config: { uri },
        name: 'FetchError'
      });
    } catch (err) {
      this.log(uri, err);
      return NaN;
    }
  }

  private _onComplete = (file: GCSFile): Promise<any> => {
    return this.deleteMetaFile(file.name);
  };

  private _checkBucket(bucketName: string): void {
    this.authClient
      .request({ url: `${storageAPI}/${bucketName}` })
      .then(() => (this.isReady = true))
      .catch((err: ClientError) => {
        // eslint-disable-next-line no-console
        console.error('error open bucket: %o', err);
        process.exit(1);
      });
  }
}
