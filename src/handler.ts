import * as bytes from 'bytes';
import * as http from 'http';
import * as getRawBody from 'raw-body';
import * as url from 'url';
import {
  BaseHandler,
  BaseStorage,
  DiskStorageConfig,
  ERRORS,
  File,
  Request,
  UploadxConfig,
  UploadXError
} from './core';

/**
 * X-headers  protocol implementation
 */
export class Handler extends BaseHandler {
  /**
   * Where store files
   */
  storage: BaseStorage;
  static idKey = 'upload_id';

  constructor(public options: UploadxConfig & DiskStorageConfig) {
    super();
    this.storage = options.storage as BaseStorage;
  }

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: Request): Promise<File> {
    if (!req.body) {
      try {
        const raw = await getRawBody(req, {
          length: req.headers['content-length'],
          limit: '1mb',
          encoding: true
        });
        req.body = JSON.parse(raw);
      } catch (error) {
        throw new UploadXError(ERRORS.BAD_REQUEST, error);
      }
    }
    const file = {} as File;

    file.metadata = req.body;
    'user' in req && (file.userId = req.user.id || req.user._id);
    file.filename = req.body.name || req.body.title;
    file.size = Number.parseInt(req.headers['x-upload-content-length'] || req.body.size);
    file.mimeType = req.headers['x-upload-content-type'] || req.body.mimeType;

    if (!new RegExp((this.options.allowMIME || [`\/`]).join('|')).test(file.mimeType))
      throw new UploadXError(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (isNaN(file.size)) throw new UploadXError(ERRORS.INVALID_FILE_SIZE);
    if (file.size > this.options.maxUploadSize!)
      throw new UploadXError(ERRORS.FILE_TOO_LARGE, `Max file size: ${this.options.maxUploadSize}`);
    if (!file.filename) throw new UploadXError(ERRORS.INVALID_FILE_NAME);
    return file;
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
   * Get `upload_id` from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const query = url.parse(req.url!, true).query;
    return query && (query[Handler.idKey] as string);
  }

  /**
   * Create File from request and send file url to client
   */
  async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const file = await this.buildFileFromRequest(req);
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
    if (this.options.maxChunkSize && +req.headers['content-length']! > this.options.maxChunkSize) {
      throw new UploadXError(
        ERRORS.CHUNK_TOO_BIG,
        `Chunk size limit: ${bytes(this.options.maxChunkSize as number)}`
      );
    }
    const id = this.getFileId(req);
    if (!id) throw new UploadXError(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const rangeHeader = req.headers['content-range'];
    if (!rangeHeader) throw new UploadXError(ERRORS.INVALID_RANGE);
    const [total, end, start] = rangeHeader
      .split(/\D+/)
      .filter(v => v.length)
      .map(s => +s)
      .reverse();
    const file = await this.storage.write(req as any, { total, end, start, id });
    if (file.bytesWritten === file.size) {
      req['file'] = file;
    } else {
      res.setHeader('Access-Control-Expose-Headers', 'Range');
      res.setHeader('Range', `bytes=0-${file.bytesWritten! - 1}`);
      this.send(res, 308);
    }
    return file;
  }

  list(req: http.IncomingMessage, res: http.ServerResponse) {
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
