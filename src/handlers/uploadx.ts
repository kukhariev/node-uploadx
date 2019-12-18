import * as http from 'http';
import * as url from 'url';
import { BaseStorage, DiskStorage, DiskStorageOptions, File, FileInit } from '../storages';
import { ERRORS, fail, getBaseUrl, getHeader, getJsonBody } from '../utils';
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

  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const metadata = await getJsonBody(req).catch(error => fail(ERRORS.BAD_REQUEST, error));
    const file = await this.storage.update(name, { metadata, name });
    this.send({ res, body: file });
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async put(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const contentRange = getHeader(req, 'content-range');
    const contentLength = +getHeader(req, 'content-length');
    const { start } = contentRange ? rangeParser(contentRange) : { start: 0 };
    const file = await this.storage.write({ start, name, contentLength, body: req });
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
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(name);
    this.send({ res, statusCode: 204 });
    file.status = 'deleted';
    return file;
  }

  getName(req: http.IncomingMessage): string {
    const { query } = url.parse(req.url || '', true);
    if (query.upload_id) return query.upload_id as string;
    if (query.name) return query.name as string;
    return super.getName(req);
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    if ('GCSUploadURI' in file && file['GCSUploadURI']) return file['GCSUploadURI'];

    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { query, pathname } = url.parse(originalUrl, true);
    // eslint-disable-next-line @typescript-eslint/camelcase
    query.upload_id = file.name;
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
