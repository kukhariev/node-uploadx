import * as http from 'http';
import * as querystring from 'querystring';
import * as url from 'url';
import { BaseHandler, BaseStorage, ERRORS, fail, File } from './core';
import { DiskStorage, DiskStorageOptions } from './core/DiskStorage';
import { getBody, logger, getHeader } from './core/utils';
const log = logger.extend('Uploadx');

export function rangeParser(
  rangeHeader = ''
): {
  start: number;
  total: number;
} {
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
  idKey = 'upload_id';
  storage: T | DiskStorage;

  constructor(config: { storage: T } | DiskStorageOptions) {
    super();
    this.storage = 'storage' in config ? config.storage : new DiskStorage(config);
    this.responseType = 'json';
    log('options: %o', config);
  }

  /**
   * Create File from request and send file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const metadata = await getBody(req).catch(() => fail(ERRORS.BAD_REQUEST));
    const file = new File(metadata);
    file.userId = this.getUserId(req);
    file.size = Number(getHeader(req, 'x-upload-content-length') || file.size);
    file.mimeType = getHeader(req, 'x-upload-content-type') || file.mimeType;
    file.generateId();
    await this.storage.create(req, file);
    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    const headers = { Location: this.buildFileUrl(req, file) };
    this.send({ res, statusCode, headers });
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async put(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND, 'File id cannot be retrieved');
    const userId = this.getUserId(req);
    const contentLength = Number(req.headers['content-length']);
    const contentRange = req.headers['content-range'];
    const { start, total } = contentRange
      ? rangeParser(contentRange)
      : { start: 0, total: contentLength };
    const chunk = { start, total, id, userId };
    const file = await this.storage.write(req, chunk);
    if (file.bytesWritten < file.size) {
      const headers = { Range: `bytes=0-${file.bytesWritten - 1}` };
      res.statusMessage = 'Resume Incomplete';
      this.send({ res, statusCode: Uploadx.RESUME_STATUS_CODE, headers });
      file.status = 'part';
    } else {
      file.status = 'completed';
      this.send({ res, body: file.metadata });
    }
    return file;
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND);
    const userId = this.getUserId(req);
    const [file] = await this.storage.delete({ id, userId });
    this.send({ res, statusCode: 204 });
    file.status = 'deleted';
    return file;
  }

  async get(req: http.IncomingMessage, res: http.ServerResponse): Promise<File[]> {
    const userId = this.getUserId(req);
    const id = this.getFileId(req);
    const files = await this.storage.get({ id, userId });
    return files;
  }

  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string {
    const { query } = url.parse(req.url || '', true);
    return query[this.idKey] as string;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { query, pathname } = url.parse(originalUrl, true);
    const uri = `${pathname}?${querystring.stringify({
      ...query,
      ...{
        [this.idKey]: file.id
      }
    })}`;
    const isFullUrl = req.headers.host && !this.storage.config.useRelativeLocation;
    return isFullUrl ? `//${req.headers.host}${uri}` : `${uri}`;
  }
}

/**
 * Basic express wrapper
 */
export function uploadx(
  options: DiskStorageOptions = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  const upl = new Uploadx(options);
  return upl.handle;
}
