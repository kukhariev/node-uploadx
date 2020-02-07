import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
import { File, UploadEventType } from '../storages/file';
import { ERRORS, ErrorStatus, getBaseUrl, Logger } from '../utils';
import { Cors } from './cors';

const handlers = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;
export const REQUEST_METHODS = handlers.map(s => s.toUpperCase());
export type Headers = Record<string, string | number>;
export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
type Handlers = typeof handlers[number];
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};

export interface BaseHandler extends EventEmitter {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on<T = File>(event: UploadEventType, listener: (file: T) => void): this;
  off<T = File>(event: UploadEventType, listener: (file: T) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit<T = File>(event: UploadEventType, evt: T): boolean;
  emit(event: 'error', evt: ErrorStatus): boolean;
}

export abstract class BaseHandler extends EventEmitter implements MethodHandler {
  responseType: 'text' | 'json' = 'text';
  protected log = Logger.get(this.constructor.name);
  private _registeredHandlers: Map<string, AsyncHandler> = new Map();
  constructor() {
    super();

    this.compose();
  }

  compose(): void {
    handlers.forEach(method => {
      const enabled = (this as MethodHandler)[method];
      enabled && this._registeredHandlers.set(method.toUpperCase(), enabled);
    });
    this.log('Handlers', this._registeredHandlers);
  }

  handle = (req: http.IncomingMessage, res: http.ServerResponse, next?: Function): void => {
    this.log(`[request]: %s`, req.method, req.url);
    Cors.preflight(req, res);
    if (!this.storage.isReady) {
      return this.sendError(res, ERRORS.STORAGE_ERROR);
    }
    const handler = this._registeredHandlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then((file: File | File[]) => {
          if ('status' in file && file.status) {
            this.log('[%s]: %s', file.status, file.name);
            this.listenerCount(file.status) && this.emit(file.status, file);
            return;
          }
          if (req.method === 'GET') {
            (req as any).body = file;
            next ? next() : this.send({ res, body: file });
          }
          return;
        })
        .catch((error: any) => {
          this.listenerCount('error') && this.emit('error', error);
          this.log('[error]: %o', error);
          if ('aborted' in req && req['aborted']) {
            return;
          }
          this.sendError(res, error);
          return;
        });
    } else {
      this.send({ res, statusCode: 404 });
    }
  };

  getUserId = (req: any): string | undefined => req.user?.id || req.user?._id;

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    res.setHeader('Content-Length', 0);
    res.writeHead(204);
    res.end();
    return Promise.resolve({} as File);
  }

  /**
   * `GET` request handler
   */
  async get<T>(req: http.IncomingMessage): Promise<T[]> {
    const name = this.getName(req);
    const files = await this.storage.get(name);
    return files;
  }

  /**
   * Make response
   */
  send({
    res,
    statusCode = 200,
    headers = {},
    body = ''
  }: {
    res: http.ServerResponse;
    statusCode?: number;
    headers?: Headers;
    body?: Record<string, any> | string;
  }): void {
    const json = typeof body !== 'string';
    const data = json ? JSON.stringify(body) : `${body}`;
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    const exposeHeaders = Object.keys(headers).toString();
    exposeHeaders && res.setHeader('Access-Control-Expose-Headers', exposeHeaders);
    json && data && res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode, headers);
    res.end(data);
  }

  /**
   * Send Error to client
   */
  sendError(res: http.ServerResponse, error: any): void {
    const statusCode = +error.statusCode || +error.code || +error.status || 500;
    error.message = error.message || 'unknown error';
    const { message, code, detail } = error;
    const body = this.responseType === 'json' ? { message, code, detail } : error.message;
    this.send({ res, statusCode, body });
  }

  /**
   * Get id from request
   */
  getName(req: http.IncomingMessage): string {
    const { pathname } = url.parse(req.url as string);
    const path = (req as any)['originalUrl']
      ? `/${pathname}`.replace('//', '')
      : `/${pathname}`.replace(`/${this.storage.path}/`, '');
    return path.startsWith('/') ? '' : path;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { pathname, query } = url.parse(originalUrl, true);
    const path = url.format({ pathname: `${pathname}/${file.name}`, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return `${baseUrl}${path}`;
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  abstract storage: any;
}
