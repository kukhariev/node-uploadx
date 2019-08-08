import * as bytes from 'bytes';
import { EventEmitter } from 'events';
import * as http from 'http';
import { ERRORS, ErrorStatus, fail } from './';
import { File, BaseConfig } from './interfaces';
export interface BaseHandle {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'completed' | 'deleted' | 'error', evt: File | ErrorStatus): boolean;
}
interface Indexable {
  [key: string]: any;
}
export abstract class BaseHandler<T> extends EventEmitter {
  private readonly mimeRegExp = new RegExp((this.options.allowMIME || ['/']).join('|'));
  cors = {
    allowedMethods: ['GET', 'HEAD', 'PATCH', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: '',
    maxAge: 600,
    withCredentials: false,
    origin: []
  };
  responseType: 'text' | 'json' = 'text';
  protected handlers: any = { GET: 'read' };
  private readonly maxUploadSize = bytes.parse(
    this.options.maxUploadSize || Number.MAX_SAFE_INTEGER
  );

  constructor(public options: BaseConfig<T>) {
    super();
  }
  /**
   * Uploads handler
   */
  public handle = <T extends http.IncomingMessage, U extends http.ServerResponse>(
    req: T,
    res: U,
    next?: any
  ): void => {
    this.setOrigin(req, res);
    if (req.method === 'OPTIONS') {
      return this.preFlight(req, res);
    }
    if (req.method) {
      const method = this.handlers[req.method];
      (this as Indexable)
        [method](req, res)
        .then((file: File | File[]) => {
          if (!file) {
            next ? next() : this.send(res, 415);
          } else if ('status' in file) {
            this.emit(file.status, file);
            if (file.status === 'completed') {
              (req as any).file = file;
              next ? next() : this.send(res, 200, {}, file.metadata);
            }
          }
        })
        .catch((error: any) => {
          this.listenerCount('error') && this.emit('error', error);
          next ? next(error) : this.sendError(req, res, error);
        });
    } else {
      next ? next() : this.send(res, 405);
    }
  };
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File>;
  /**
   * Chunks
   */
  abstract update(req: http.IncomingMessage, res: http.ServerResponse, next?: any): Promise<File>;
  /**
   * Delete by id
   */
  abstract delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File>;

  protected getUserId(req: any): string {
    return 'user' in req && (req.user.id || req.user._id);
  }
  protected checkLimits(file: File) {
    if (!this.mimeRegExp.test(file.mimeType)) return fail(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (file.size > this.maxUploadSize)
      return fail(ERRORS.FILE_TOO_LARGE, `File size limit: ${bytes(this.maxUploadSize)}`);
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
      this.cors.allowedHeaders || req.headers['access-control-request-headers'] || '';
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
    body: { [key: string]: any } | string = ''
  ) {
    const json = typeof body !== 'string';
    const data = json ? JSON.stringify(body) : (body as string);
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    json && data && res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode, headers);
    res.end(data);
  }

  /**
   * Send Error to client
   */
  sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void {
    const statusCode = error.statusCode || 500;
    error.message = error.message || 'unknown error';
    const body = this.responseType === 'json' ? error : error.message;
    this.send(res, statusCode, {}, body);
  }
}
