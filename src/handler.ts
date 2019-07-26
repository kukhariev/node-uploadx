import * as bytes from 'bytes';
import * as http from 'http';
import * as url from 'url';
import { BaseHandler, ERRORS, File, UploadXError, NextFunction, Request, Response } from './core';
import { getBody } from './utils';

/**
 * X-headers  protocol implementation
 */
export class Handler extends BaseHandler {
  emit(arg0: string, file: any) {}
  static idKey = 'upload_id';

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: http.IncomingMessage): Promise<File> {
    const file = {} as File;
    try {
      file.metadata = await getBody(req);
      file.userId = this.getUserId(req);
      file.filename = file.metadata.name || file.metadata.title;
      file.size = +(req.headers['x-upload-content-length'] || file.metadata.size);
      file.mimeType = req.headers['x-upload-content-type'] || file.metadata.mimeType;
    } catch (error) {
      throw new UploadXError(ERRORS.BAD_REQUEST, error);
    }
    return file;
  }

  handle = async (req: Request, res: Response, next?: NextFunction) => {
    try {
      this.setOrigin(req, res);
      switch (req.method) {
        case 'POST':
          const file = await this.create(req, res);
          this.emit('created', file);
          break;
        case 'PUT':
          await this.write(req, res);
          if (req.file) {
            this.emit('complete', req.file);
            next ? next() : this.send(res, 200, {}, req.file!.metadata);
          }
          break;
        case 'DELETE':
          const deleted = await this.delete(req, res);
          this.emit('deleted', deleted);
          this.send(res, 200, {}, deleted);
          break;
        case 'GET':
          const files = await this.list(req, res);
          this.send(res, 200, {}, files);
          break;
        case 'OPTIONS':
          this.preFlight(req, res);
          break;
        default:
          this.send(res, 404);
      }
    } catch (error) {
      this.emit('error', error);
      next ? next(error) : this.sendError(req, res, error);
    }
  };
  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const query = url.parse(req.url!, true).query;
    return query[Handler.idKey] as string;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, id: string): string {
    const urlObject = url.parse(req.url!, true);
    const query = urlObject.query;
    const baseUrl = (req['baseUrl'] as string) || urlObject.pathname || '';
    const search = Object.keys(query).reduce(
      (acc, key) => acc + `&${key}=${query[key] || ''}`,
      `?${Handler.idKey}=${id}`
    );
    const location: string =
      !this.options.useRelativeURL && req.headers.host
        ? `//${req.headers.host}${baseUrl}${search}`
        : `${baseUrl}${search}`;
    return location;
  }

  /**
   * Create File from request and send file url to client
   */
  async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const file = await this.buildFileFromRequest(req);
    this.validateFile(file);
    const { bytesWritten, id } = await this.storage.create(req as any, file);
    const statusCode = bytesWritten ? 200 : 201;
    const location = this.buildFileUrl(req, id);
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    res.setHeader('Location', location);
    this.send(res, statusCode);
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async write(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) throw new UploadXError(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const contentLength = +req.headers['content-length']!;
    const contentRange = req.headers['content-range'];
    const { start, total } = contentRange
      ? rangeParser(contentRange)
      : { start: 0, total: contentLength };
    const file = await this.storage.write(req as any, { start, total, id });
    if (file.bytesWritten === file.size) {
      req['file'] = file;
    } else {
      res.setHeader('Access-Control-Expose-Headers', 'Range');
      res.setHeader('Range', `bytes=0-${file.bytesWritten! - 1}`);
      this.send(res, 308);
    }
    return file;
  }

  list(req: http.IncomingMessage, res: http.ServerResponse): Promise<File[]> {
    return this.storage.list(req);
  }

  /**
   * Delete upload by id
   */
  delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) throw new UploadXError(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    return this.storage.delete(id);
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
