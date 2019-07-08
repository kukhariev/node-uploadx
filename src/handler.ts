import * as bytes from 'bytes';
import * as http from 'http';
import * as url from 'url';
import { BaseHandler, BaseStorage, ERRORS, File, UploadxConfig, UploadXError } from './core';
import { getBody } from './utils';

/**
 * X-headers  protocol implementation
 */
export class Handler extends BaseHandler {
  /**
   * Where store files
   */
  storage: BaseStorage;
  static idKey = 'upload_id';

  private readonly mimeRegExp = new RegExp((this.options.allowMIME || [`\/`]).join('|'));

  constructor(public options: UploadxConfig) {
    super();
    this.storage = options.storage as BaseStorage;
  }

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
    if (!this.mimeRegExp.test(file.mimeType)) throw new UploadXError(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (isNaN(file.size)) throw new UploadXError(ERRORS.INVALID_FILE_SIZE);
    if (file.size > this.options.maxUploadSize!)
      throw new UploadXError(ERRORS.FILE_TOO_LARGE, `Max file size: ${this.options.maxUploadSize}`);
    return file;
  }

  protected getUserId(req: any): string {
    return 'user' in req ? req.user.id || req.user._id : '';
  }
  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const query = url.parse(req.url!, true).query;
    return query && (query[Handler.idKey] as string);
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
    if (+req.headers['content-length']! > this.options.maxChunkSize!) {
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
      .filter(Boolean)
      .map(Number)
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
