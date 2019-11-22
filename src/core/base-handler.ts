import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
import { BaseStorage, ErrorStatus } from '.';
import { Cors } from './cors';
import { File } from './file';
import { logger } from './utils';

const log = logger.extend('core');
const RE_PATH_ID = /[^/]+\/([^/]+)$/;
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
  on(event: 'created' | 'completed' | 'deleted' | 'part', listener: (file: File) => void): this;
  off(event: 'created' | 'completed' | 'deleted' | 'part', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'completed' | 'deleted' | 'part', evt: File): boolean;
  emit(event: 'error', evt: ErrorStatus): boolean;
}

export abstract class BaseHandler extends EventEmitter implements MethodHandler {
  responseType: 'text' | 'json' = 'text';
  idKey = 'upload_id';
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
    log('Handlers', this._registeredHandlers);
  }

  handle = (req: http.IncomingMessage, res: http.ServerResponse, next?: Function): void => {
    log(`[request]: %s`, req.method, req.url);
    Cors.preflight(req, res);
    const handler = this._registeredHandlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then((file: File | File[]) => {
          if ('status' in file && file.status) {
            log('[%s] [%s]: %s', this.constructor.name, file.status, file.path || file.id);
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
          log('[%s] [error]: %o', this.constructor.name, error);
          this.sendError(res, error);
          return;
        });
    } else {
      this.send({ res, statusCode: 404 });
    }
  };

  getUserId = (req: any): string | null => ('user' in req ? req.user.id || req.user._id : null);

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    res.setHeader('Content-Length', 0);
    res.writeHead(204);
    res.end();
    return Promise.resolve({} as File);
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
  getFileId(req: http.IncomingMessage): string | undefined {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { query, pathname } = url.parse(originalUrl, true);
    return (query[this.idKey] as string) || (RE_PATH_ID.exec(pathname || '') || [])[1];
  }

  /**
   * `GET` request handler
   */
  async get(req: http.IncomingMessage): Promise<File[]> {
    const userId = this.getUserId(req);
    const id = this.getFileId(req);
    const files = await this.storage.get({ id, userId });
    return files;
  }

  // eslint-disable-next-line @typescript-eslint/member-ordering
  abstract storage: BaseStorage;
}
