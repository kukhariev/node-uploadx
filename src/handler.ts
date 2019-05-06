import * as http from 'http';
import * as getRawBody from 'raw-body';
import * as url from 'url';
import {
  BaseHandler,
  BaseStorage,
  ERRORS,
  Request,
  File,
  UploadXError,
  UploadxConfig,
  DiskStorageConfig
} from './core';

/**
 * X-headers  protocol implementation
 */
export class Handler extends BaseHandler {
  /**
   * Where store files
   */
  storage: BaseStorage;

  constructor(public options: UploadxConfig & DiskStorageConfig) {
    super();
    this.storage = options.storage as BaseStorage;
  }
  /**
   * Parse  Create request
   * @internal
   */
  private async buildFileFromRequest(req: Request) {
    if (!req.body) {
      try {
        const raw = await getRawBody(req, {
          length: req.headers['content-length'],
          limit: '1mb',
          encoding: true
        });
        req.body = JSON.parse(raw);
      } catch (error) {
        throw new UploadXError(ERRORS.UNKNOWN_ERROR, error);
      }
    }
    const file = {} as File;
    const user = req['user'];
    file.userId = user && (user.id || user._id);
    file.mimeType = req.headers['x-upload-content-type'] || req.body.mimeType;
    if (!new RegExp((this.options.allowMIME || [`\/`]).join('|')).test(file.mimeType))
      throw new UploadXError(ERRORS.INVALID_FILE_TYPE);
    file.size = Number.parseInt(req.headers['x-upload-content-length'] || req.body.size);
    if (isNaN(file.size)) throw new UploadXError(ERRORS.INVALID_FILE_SIZE);
    if (file.size > this.options.maxUploadSize!) throw new UploadXError(ERRORS.FILE_TOO_BIG);
    file.metadata = req.body;
    file.filename = req.body.name || req.body.title;
    if (!file.filename) throw new UploadXError(ERRORS.INVALID_FILE_NAME);
    return file;
  }

  /**
   * Create File from request and send File URI to client
   */
  async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const urlObject = url.parse(req.url!, true);
    const originalQuery = urlObject.query;
    const baseUrl = req['baseUrl'] || urlObject.pathname!.toLowerCase();
    const file = await this.buildFileFromRequest(req);
    const { bytesWritten, id } = await this.storage.create(req as any, file);
    const statusCode = bytesWritten ? 200 : 201;
    const query: string = Object.keys(originalQuery).reduce(
      (acc, key) => acc + `&${key}=${originalQuery[key] || 'true'}`,
      `?upload_id=${id}`
    );
    const location: string =
      !this.options.useRelativeURL && req.headers.host
        ? `//${req.headers.host}${baseUrl || ''}${query}`
        : `${baseUrl || ''}${query}`;
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    res.setHeader('Location', location);
    this.send(res, statusCode);
    return file;
  }
  /**
   * Write chunk to file or/and return chunk offset
   */
  async write(req: http.IncomingMessage, res: http.ServerResponse) {
    if (this.options.maxChunkSize && +req.headers['content-length']! > this.options.maxChunkSize) {
      throw new UploadXError(ERRORS.CHUNK_SIZE_TOO_BIG);
    }
    const urlObject = url.parse(req.url!, true);
    const id = urlObject.query.upload_id as string;
    const rangeHeader = req.headers['content-range'];
    if (!rangeHeader) throw new UploadXError(ERRORS.MISSING_RANGE);
    const [total, end, start] = rangeHeader!
      .split(/\D+/)
      .filter(v => v.length)
      .map(s => +s)
      .reverse();
    req.on('error', () => {
      throw new UploadXError(ERRORS.UNKNOWN_ERROR);
    });
    const file = await this.storage.write(req as any, { total, end, start, id });
    if (file.bytesWritten === file.size) {
      req['file'] = file;
    } else {
      res.setHeader('Access-Control-Expose-Headers', 'Range');
      res.setHeader('Range', `bytes=0-${file.bytesWritten! - 1}`);
      this.send(res, 308);
    }
  }
  list(req: http.IncomingMessage, res: http.ServerResponse) {
    return this.storage.list(req);
  }
  /**
   * Delete upload by id
   */
  delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const urlObject = url.parse(req.url!, true);
    const id = urlObject.query.upload_id as string;
    return this.storage.delete(id);
  }
  /**
   * Set Origin header
   * @internal
   */
  setOrigin(req: http.IncomingMessage, res: http.ServerResponse) {
    req.headers.origin && res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
  }
  /**
   * OPTIONS preflight Request
   * @internal
   */
  preFlight(req: http.IncomingMessage, res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,PATCH,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers']!);
    this.send(res, 204);
  }

  /**
   * Send Error object to client
   */
  sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void {
    const statusCode = error.statusCode || 500;
    const errorBody = {
      error: {
        code: error.code,
        message: error.message || 'unknown error'
      }
    };
    this.send(res, statusCode, {}, errorBody);
  }
}
