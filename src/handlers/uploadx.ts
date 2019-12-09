/* eslint-disable @typescript-eslint/camelcase */
import * as http from 'http';
import * as url from 'url';
import { DiskStorage, DiskStorageOptions } from '../storages/disk-storage';
import { File, FileInit } from '../storages/file';
import { BaseStorage } from '../storages/storage';
import { ERRORS, fail, getBaseUrl, getHeader, getJsonBody, hmacSHA256 } from '../utils';
import { BaseHandler, Headers } from './base-handler';

export function rangeParser(rangeHeader = ''): { start: number; total: number } {
  const parts = rangeHeader.split(/\s+|\//);
  const total = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, total };
}

/**
 * X-headers  protocol implementation
 */
export class Uploadx<T extends BaseStorage> extends BaseHandler {
  static RESUME_STATUS_CODE = 308;

  storage: T | DiskStorage;

  private readonly SECRET = process.env['UPLOADX_SECRET_KEY'] || 'Wozwuhkuz';

  constructor(config: { storage: T } | DiskStorageOptions) {
    super();
    this.storage = 'storage' in config ? config.storage : new DiskStorage(config);
    this.responseType = 'json';
    this.log('options: %o', config);
  }

  /**
   * Create File from request and send file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const metadata = await getJsonBody(req).catch(error => fail(ERRORS.BAD_REQUEST, error));
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req);
    config.size = getHeader(req, 'x-upload-content-length');
    config.contentType = getHeader(req, 'x-upload-content-type');
    const file = await this.storage.create(req, config);

    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    const headers: Headers = { Location: this.buildFileUrl(req, file) };
    this.send({ res, statusCode, headers });
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async put(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const path = this.getPath(req);
    if (!path) return fail(ERRORS.FILE_NOT_FOUND);
    const contentRange = getHeader(req, 'content-range');
    const contentLength = +getHeader(req, 'content-length');
    const { start } = contentRange ? rangeParser(contentRange) : { start: 0 };
    const file = await this.storage.write({ start, path, contentLength, body: req });
    if (file.bytesWritten < file.size) {
      const headers: Headers = { Range: `bytes=0-${file.bytesWritten - 1}` };
      res.statusMessage = 'Resume Incomplete';
      this.send({ res, statusCode: Uploadx.RESUME_STATUS_CODE, headers });
      file.status = 'part';
    } else if (file.bytesWritten === file.size) {
      file.status = 'completed';
      this.send({ res, body: file });
    }
    return file;
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const path = this.getPath(req);
    if (!path) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(path);
    this.send({ res, statusCode: 204 });
    file.status = 'deleted';
    return file;
  }

  getPath(req: http.IncomingMessage): string {
    const { query } = url.parse(req.url || '', true);
    const name = query.name as string;
    const upload_id = query.upload_id as string;
    if (this.SECRET && (!upload_id || !name)) return '';
    if (this.SECRET && hmacSHA256(name, this.SECRET) !== upload_id) return '';
    if (name) return name;
    if (upload_id) return upload_id;
    return super.getPath(req);
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    if ('GCSUploadURI' in file && file['GCSUploadURI']) return file['GCSUploadURI'];

    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { query, pathname } = url.parse(originalUrl, true);
    query.upload_id = this.SECRET ? hmacSHA256(file.path, this.SECRET) : file.path;
    query.name = file.path;
    const path = url.format({ pathname, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return baseUrl ? `${baseUrl}${path}` : `${path}`;
  }
}

/**
 * Basic express wrapper
 */
export function uploadx(
  options: DiskStorageOptions | { storage: BaseStorage } = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  return new Uploadx(options).handle;
}
