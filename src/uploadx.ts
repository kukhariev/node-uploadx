import * as http from 'http';
import * as url from 'url';
import * as querystring from 'querystring';
import { BaseHandler, ERRORS, File, DiskStorageConfig, UploadxConfig, fail } from './core';
import { getBody } from './utils';
import { DiskStorage } from './disk-storage';

/**
 * X-headers  protocol implementation
 */
export class Uploadx extends BaseHandler {
  static idKey = 'upload_id';
  handlers = {
    POST: 'create',
    PUT: 'write',
    DELETE: 'delete'
  };
  constructor(public options: UploadxConfig) {
    super(options);
    this.storage = options.storage || new DiskStorage(options as DiskStorageConfig);
  }

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: http.IncomingMessage): Promise<File> {
    const file = {} as File;
    file.metadata = await getBody(req);
    file.userId = this.getUserId(req);
    file.filename = file.metadata.name || file.metadata.title;
    file.size = +(req.headers['x-upload-content-length'] || file.metadata.size);
    file.mimeType = req.headers['x-upload-content-type'] || file.metadata.mimeType;
    return file;
  }

  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const query = url.parse(req.url!, true).query;
    return query[Uploadx.idKey] as string;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, id: string): string {
    const { query, pathname } = url.parse(req.url!, true);
    const baseUrl = (req['baseUrl'] as string) || pathname || '';
    const uri = `${baseUrl}?${querystring.stringify({ ...query, ...{ [Uploadx.idKey]: id } })}`;
    const location: string =
      !this.options.useRelativeURL && req.headers.host ? `//${req.headers.host}${uri}` : `${uri}`;
    return location;
  }

  /**
   * Create File from request and send file url to client
   */
  async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    let file = await this.buildFileFromRequest(req);
    await this.validateFile(file);
    file = await this.storage.create(req, file);
    const statusCode = file.bytesWritten ? 200 : 201;
    const location = this.buildFileUrl(req, file.id);
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    res.setHeader('Location', location);
    this.send(res, statusCode);
    file.status = 'created';
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async write(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const contentLength = +req.headers['content-length']!;
    const contentRange = req.headers['content-range'];
    const { start, total } = contentRange
      ? rangeParser(contentRange)
      : { start: 0, total: contentLength };
    const file = await this.storage.write(req, { start, total, id });
    if (file.bytesWritten < file.size) {
      res.setHeader('Access-Control-Expose-Headers', 'Range');
      res.setHeader('Range', `bytes=0-${file.bytesWritten! - 1}`);
      this.send(res, 308);
    } else {
      file.status = 'complete';
    }
    return file;
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const file = await this.storage.delete(id);
    this.send(res, 200, {}, file.metadata);
    file.status = 'deleted';
    return file;
  }
  list(req: http.IncomingMessage, res: http.ServerResponse) {
    return this.storage.list(req);
  }
  /**
   * Send Error object to client
   */
  sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void {
    const statusCode = error.statusCode || 500;
    const errorBody = {
      error: {
        code: error.code || 'unknown_error',
        message: error.message || 'unknown error'
      }
    };
    this.send(res, statusCode, {}, errorBody);
  }
}

export function rangeParser(rangeHeader = '') {
  const parts = rangeHeader.split(/\s+|\//);
  const total = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, total };
}

/**
 * Basic express wrapper
 */
export function uploadx(options: UploadxConfig & DiskStorageConfig) {
  const upl = new Uploadx(options);
  return upl.handle;
}
