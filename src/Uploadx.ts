import * as http from 'http';
import * as querystring from 'querystring';
import * as url from 'url';
import { BaseConfig, BaseHandler, BaseStorage, ERRORS, fail, File } from './core';
import { DiskStorage, DiskStorageOptions } from './DiskStorage';
import { getBody, logger, pick, hashObject } from './utils';
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
export class Uploadx extends BaseHandler {
  idKey = 'upload_id';
  storage: BaseStorage;
  constructor(public config: BaseConfig) {
    super(config);
    this.storage = config.storage || new DiskStorage(config as DiskStorageOptions);
    this.responseType = 'json';
    log('options: %o', this.config);
  }

  /**
   * Create File from request and send file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const meta = await this.buildFileFromRequest(req);
    const file = await this.storage.create(req, meta);
    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    const location = this.buildFileUrl(req, file.id);
    const headers = { 'Access-Control-Expose-Headers': 'Location', Location: location };
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
      const headers = {
        'Access-Control-Expose-Headers': 'Range',
        Range: `bytes=0-${file.bytesWritten - 1}`
      };
      res.statusMessage = 'Resume Incomplete';
      this.send({ res, statusCode: 308, headers });
    } else {
      file.status = 'completed';
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
    const body = files.map(file => pick(file, ['metadata', 'id']));
    this.send({ res, body });
    return files;
  }

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: http.IncomingMessage): Promise<File> {
    const file = ({} as unknown) as File;
    file.userId = this.getUserId(req);
    const metadata = await getBody(req).catch(() => fail(ERRORS.BAD_REQUEST));
    file.metadata = metadata;
    file.filename = metadata.name || metadata.title;
    file.size = Number(req.headers['x-upload-content-length'] || metadata.size);
    file.mimeType =
      req.headers['x-upload-content-type'] || metadata.mimeType || 'application/octet-stream';
    file.id = this.getFileId(req) || hashObject(file);
    return file;
  }

  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const { query } = url.parse(req.url || '', true);
    return query[this.idKey] as string;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, id: string): string {
    const s = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { query, pathname } = url.parse(s, true);
    const uri = `${pathname}?${querystring.stringify({
      ...query,
      ...{
        [this.idKey]: id
      }
    })}`;
    const isFullUrl = req.headers.host && !this.config.useRelativeLocation;
    return isFullUrl ? `//${req.headers.host}${uri}` : `${uri}`;
  }
}

/**
 * Basic express wrapper
 */
export function uploadx(
  options: BaseConfig & DiskStorageOptions
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  const upl = new Uploadx(options);
  return upl.handle;
}
