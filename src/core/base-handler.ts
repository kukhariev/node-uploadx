import * as bytes from 'bytes';
import { EventEmitter } from 'events';
import * as http from 'http';
import { BaseStorage, ERRORS, ErrorStatus, fail } from './';
import { File, UploadxConfig } from './interfaces';
export interface BaseHandle {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'complete' | 'deleted' | 'error', evt: File | ErrorStatus): boolean;
}
export abstract class BaseHandler extends EventEmitter {
  private readonly mimeRegExp = new RegExp((this.options.allowMIME || [`\/`]).join('|'));
  cors = {
    allowedMethods: ['GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: '',
    maxAge: 600,
    withCredentials: false,
    origin: []
  };

  /**
   * Where store files
   */
  storage: BaseStorage;
  /**
   * Uploads handler
   */
  handle = <T extends http.IncomingMessage, U extends http.ServerResponse>(
    req: T,
    res: U,
    next?: any
  ) => {
    Promise.resolve(this._handler(req, res, next)).catch(next);
  };
  handlers = {
    POST: 'create',
    PUT: 'write'
  };
  constructor(public options: UploadxConfig) {
    super();

    this.storage = options.storage!;
    Object.assign(this.storage.options, options);
  }

  async _handler<T extends http.IncomingMessage, U extends http.ServerResponse>(
    req: T,
    res: U,
    next?: any
  ) {
    let file: File = {} as File;

    this.setOrigin(req, res);
    if (req.method === 'OPTIONS') {
      return this.preFlight(req, res);
    }
    const method = this.handlers[req.method!];

    if (method) {
      file = await this[method](req, res).catch((error: any) => {
        this.listenerCount('error') && this.emit('error', error);
        next ? next(error) : this.sendError(req, res, error);
      });
    } else {
      next ? next() : this.send(res, 405);
    }
    if (!file) {
      next ? next() : this.send(res, 415);
    } else {
      file.status && this.emit(file.status, file);
      if (file.status === 'complete') {
        req['file'] = file;
        next ? next() : this.send(res, 200, {}, file.metadata);
      }
    }
  }
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File | undefined>;
  /**
   * Chunks
   */
  abstract write(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    next?: any
  ): Promise<File | undefined>;
  /**
   * Delete by id
   */
  abstract delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File | undefined>;
  /**
   * Make formated httpError response
   */
  abstract sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void;
  protected getUserId(req: any): string {
    return 'user' in req ? req.user.id || req.user._id : '';
  }
  protected validateFile(file: File) {
    const maxUploadSize = bytes.parse(this.options.maxUploadSize || Number.MAX_SAFE_INTEGER);
    if (!this.mimeRegExp.test(file.mimeType)) return fail(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (file.size > maxUploadSize)
      return fail(ERRORS.FILE_TOO_LARGE, `Max file size limit: ${bytes(maxUploadSize)}`);
    return Promise.resolve(file);
  }
  /**
   * Set Origin header
   */
  setOrigin(req: http.IncomingMessage, res: http.ServerResponse) {
    const origin = this.cors.origin.length ? this.cors.origin.join(',') : req.headers.origin;
    origin && this.setHeader(res, 'Access-Control-Allow-Origin', origin);
    this.cors.withCredentials && this.setHeader(res, 'Access-Control-Allow-Credentials', 'true');
  }

  /**
   * OPTIONS preflight Request
   */
  preFlight(req: http.IncomingMessage, res: http.ServerResponse) {
    const allowedHeaders =
      this.cors.allowedHeaders || req.headers['access-control-request-headers']!;
    this.setHeader(res, 'Access-Control-Allow-Methods', this.cors.allowedMethods.join(','));
    this.setHeader(res, 'Access-Control-Allow-Headers', allowedHeaders);
    this.setHeader(res, 'Access-Control-Max-Age', this.cors.maxAge);
    res.setHeader('Content-Length', '0');
    res.writeHead(204);
    res.end();
  }

  private setHeader(res: http.ServerResponse, name: string, value: string | string[] | number) {
    !res.hasHeader(name) && res.setHeader(name, value);
  }
  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    statusCode: number,
    headers = {},
    body?: { [key: string]: any } | string | undefined
  ) {
    const json = typeof body === 'object';
    const data = json ? JSON.stringify(body) : (body as string) || '';
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    json && data && res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode, headers);
    res.end(data);
  }
}
