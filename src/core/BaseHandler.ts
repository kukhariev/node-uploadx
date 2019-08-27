import { EventEmitter } from 'events';
import * as http from 'http';
import { ErrorStatus, BaseStorage } from '.';
import { logger, pick } from '../utils';
import { Cors } from './Cors';
import { File } from './File';

const log = logger.extend('core');

export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;

const handlers = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;
type Handlers = typeof handlers[number];
export const REQUEST_METHODS = handlers.map(s => s.toUpperCase());
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};
export interface BaseHandler extends EventEmitter {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on(event: 'created' | 'completed' | 'deleted' | 'partial', listener: (file: File) => void): this;
  off(event: 'created' | 'completed' | 'deleted' | 'partial', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'completed' | 'deleted' | 'partial', evt: File): boolean;
  emit(event: 'error', evt: ErrorStatus): boolean;
}

export abstract class BaseHandler extends EventEmitter implements MethodHandler {
  options?: AsyncHandler;
  responseType: 'text' | 'json' = 'text';
  private _registeredHandlers: Map<string, AsyncHandler> = new Map();
  constructor() {
    super();
    this.registerHandlers();
  }
  registerHandlers(): void {
    handlers.forEach(method => {
      const enabled = (this as MethodHandler)[method];
      if (enabled) {
        this._registeredHandlers.set(method.toUpperCase(), enabled);
      }
    });
    log('Handlers', this._registeredHandlers);
  }

  /**
   * Uploads handler
   */
  handle = (req: http.IncomingMessage, res: http.ServerResponse, next?: Function): void => {
    log(`[request]: %s`, req.method, req.url);
    if (Cors.preflight(req, res)) {
      return;
    }
    const handler = this._registeredHandlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then((file: File | File[]) => {
          if ('status' in file) {
            log('[%s]: %s', file.status, file.path);
            this.listenerCount(file.status) && this.emit(file.status, file);
            if (file.status === 'completed') {
              (req as any)._body = true;
              (req as any).body = file;
              next
                ? next()
                : this.send({
                    res,
                    body: pick(file, ['metadata', 'id'])
                  });
            }
          }
          return;
        })
        .catch((error: any) => {
          this.listenerCount('error') && this.emit('error', error);
          log('[error]: %j', error);
          this.sendError(req, res, error);
        });
    } else {
      this.send({ res, statusCode: 404 });
    }
  };

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
    headers?: Record<string, any>;
    body?: Record<string, any> | string;
  }): void {
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
    // TODO: https://jsonapi.org/examples/#error-objects-basics
    const statusCode = error.statusCode || 500;
    error.message = error.message || 'unknown error';
    const body = this.responseType === 'json' ? error : error.message;
    this.send({ res, statusCode, headers: {}, body });
  }
  protected getUserId(req: any): string | null {
    return 'user' in req ? req.user.id || req.user._id : null;
  }
  abstract storage: BaseStorage;
}
