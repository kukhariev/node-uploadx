import { EventEmitter } from 'events';
import * as http from 'http';
import { BaseStorage, File, UploadEventType } from '../storages';
import * as url from 'url';
import { ERRORS, getBaseUrl, Logger, pick, setHeaders, typeis, UploadxError } from '../utils';
import { Cors } from './cors';

const handlers = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;
export type Headers = Record<string, string | number>;
export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
type Handlers = typeof handlers[number];
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};

export interface BaseHandler extends EventEmitter {
  on(event: 'error', listener: (error: UploadxError) => void): this;

  on<T = File>(event: UploadEventType, listener: (file: T) => void): this;

  off<T = File>(event: UploadEventType, listener: (file: T) => void): this;

  off(event: 'error', listener: (error: UploadxError) => void): this;

  emit<T = File>(event: UploadEventType, evt: T): boolean;

  emit(event: 'error', evt: UploadxError): boolean;
}

export interface SendParameters {
  statusCode?: number;
  headers?: Headers;
  body?: Record<string, any> | string;
}

export abstract class BaseHandler extends EventEmitter implements MethodHandler {
  cors: Cors;
  responseType: 'text' | 'json' = 'text';
  protected log = Logger.get(this.constructor.name);
  private _registeredHandlers: Map<string, AsyncHandler> = new Map() as Map<string, AsyncHandler>;
  abstract storage: BaseStorage<any, any>;

  constructor() {
    super();
    this.cors = new Cors();
    this.compose();
  }

  compose(): void {
    handlers.forEach(method => {
      const handler = (this as MethodHandler)[method];
      handler && this._registeredHandlers.set(method.toUpperCase(), handler);
    });
    this.log('Handlers', this._registeredHandlers);
  }

  handle = (req: http.IncomingMessage, res: http.ServerResponse): void => this.upload(req, res);

  upload = (
    req: http.IncomingMessage & { body?: any; _body?: boolean },
    res: http.ServerResponse,
    next?: () => void
  ): void => {
    req.on('error', err => this.log(`[request error]: %o`, err));
    this.log(`[request]: %s`, req.method, req.url);
    this.cors.preflight(req, res);
    if (!this.storage.isReady) {
      return this.sendError(res, ERRORS.STORAGE_ERROR);
    }
    const handler = this._registeredHandlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then(async (file: File | File[]) => {
          if ('status' in file && file.status) {
            this.log('[%s]: %s', file.status, file.name);
            this.listenerCount(file.status) && this.emit(file.status, file);
            if (file.status === 'completed') {
              const body = ((await this.storage.onComplete(file)) as File) || file;
              req['_body'] = true;
              req['body'] = body;
              next ? next() : this.finish(req, res, body);
            }
            return;
          }
          if (req.method === 'GET') {
            req['body'] = file;
            next ? next() : this.send(res, { body: file });
          }
          return;
        })
        .catch((error: Error) => {
          const errorEvent: UploadxError = Object.assign(error, {
            request: pick(req, ['headers', 'method', 'url'])
          });
          this.listenerCount('error') && this.emit('error', errorEvent);
          this.log('[error]: %o', errorEvent);
          if ('aborted' in req && req['aborted']) return;
          typeis.hasBody(req) > 1e6 && res.setHeader('Connection', 'close');
          this.sendError(res, error);
          return;
        });
    } else {
      this.send(res, { statusCode: 404 });
    }
  };

  // eslint-disable-next-line
  getUserId = (req: any, res: any): string | undefined => req.user?.id || req.user?.id;

  finish(req: http.IncomingMessage, res: http.ServerResponse, file: File): void {
    return this.send(res, { body: file });
  }

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    this.send(res, { statusCode: 204 });
    return {} as File;
  }

  /**
   * `GET` request handler
   */
  get<T>(req: http.IncomingMessage): Promise<T[]> {
    const name = this.getName(req);
    return this.storage.get(name) as Promise<T[]>;
  }

  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    { statusCode = 200, headers = {}, body = '' }: SendParameters
  ): void {
    let data: string;
    if (typeof body !== 'string') {
      data = JSON.stringify(body);
      res.setHeader('Content-Type', 'application/json');
    } else {
      data = body;
    }
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    setHeaders(res, headers);
    res.writeHead(statusCode);
    res.end(data);
  }

  /**
   * Send Error to client
   */
  sendError(
    res: http.ServerResponse,
    error: {
      statusCode?: number;
      message?: string;
      code?: number;
      status?: any;
      title?: string;
      detail?: Record<string, unknown> | string;
    }
  ): void {
    const statusCode = error.statusCode || Number(error.code) || Number(error.status) || 500;
    const message = error.title || error.message;
    const { code = statusCode, detail = message } = error;
    const body = this.responseType === 'json' ? { message, code, detail } : message;
    this.send(res, { statusCode, body });
  }

  /**
   * Get id from request
   */
  getName(req: http.IncomingMessage & { originalUrl?: string }): string {
    const { pathname = '' } = url.parse(req.url as string);
    const path = req['originalUrl']
      ? `/${pathname}`.replace('//', '')
      : `/${pathname}`.replace(`/${this.storage.path}/`, '');
    return path.startsWith('/') ? '' : decodeURI(path);
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { pathname = '', query } = url.parse(originalUrl, true);
    const path = url.format({ pathname: `${pathname}/${file.name}`, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return `${baseUrl}${path}`;
  }
}
