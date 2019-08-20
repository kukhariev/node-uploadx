import * as bytes from 'bytes';
import { EventEmitter } from 'events';
import * as http from 'http';
import { ERRORS, ErrorStatus, fail } from '.';
import { logger, typeis } from '../utils';
import { BaseStorage } from './BaseStorage';
import { Cors } from './Cors';
import { File } from './File';

const log = logger.extend('core');

export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
export interface Range {
  total?: number;
  end?: number;
  start: number;
  id: string;
}

export interface BaseConfig {
  storage?: BaseStorage;
  allowMIME?: string[];
  maxUploadSize?: number | string;
  useRelativeLocation?: boolean;
}
const handlers = ['post', 'head', 'patch', 'put', 'options', 'get', 'delete'] as const;
export type Handlers = typeof handlers[number];
export const REQUEST_METHODS = handlers.map(s => s.toUpperCase());
export type MethodHandler = {
  [k in Handlers]?: AsyncHandler;
};
export interface BaseHandler extends EventEmitter {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'completed' | 'deleted' | 'error', evt: File | ErrorStatus): boolean;
}

export function logMethods(obj: any, name: string) {
  const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), name.toLowerCase());
  console.log(desc);
}
export class BaseHandler extends EventEmitter implements MethodHandler {
  static handlers: Map<string, AsyncHandler> = new Map();
  options = undefined;
  responseType: 'text' | 'json' = 'text';

  constructor(public config: BaseConfig) {
    super();

    this.registerHandlers();
  }
  static registerHandler(httpMethod: string, fn: AsyncHandler) {
    BaseHandler.handlers.set(httpMethod.toUpperCase(), fn);
  }
  registerHandlers() {
    handlers.forEach(method => {
      const enabled = (this as MethodHandler)[method];
      if (enabled) {
        BaseHandler.handlers.set(method.toUpperCase(), enabled);
      }
    });
    log('%O', BaseHandler.handlers);
  }

  /**
   * Uploads handler
   */
  public handle = <T extends http.IncomingMessage, U extends http.ServerResponse>(
    req: T,
    res: U,
    next: Function
  ): void => {
    log(`[request]: %s`, req.method, req.url);
    if (Cors.preflight(req, res)) {
      return;
    }
    const handler = BaseHandler.handlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then((file: File | File[]) => {
          if ('status' in file) {
            log('[%s]: %s', file.status, file.path);
            this.listenerCount(file.status) && this.emit(file.status, file);
            if (file.status === 'completed') {
              (req as any).file = file;
              next ? next() : this.send({ res, statusCode: 200, headers: {}, body: file.metadata });
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
    statusCode,
    headers = {},
    body = ''
  }: {
    res: http.ServerResponse;
    statusCode: number;
    headers?: Record<string, any>;
    body?: Record<string, any> | string;
  }) {
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
    this.send({ res, statusCode, headers: {}, body });
  }
  protected getUserId(req: any): string {
    return 'user' in req && (req.user.id || req.user._id);
  }
  protected checkLimits(file: File) {
    if (!typeis.is(file.mimeType, this.config.allowMIME)) return fail(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (file.size > bytes.parse(this.config.maxUploadSize || Number.MAX_SAFE_INTEGER))
      return fail(ERRORS.FILE_TOO_LARGE, `File size limit: ${this.config.maxUploadSize}`);
    return Promise.resolve(file);
  }
}

export function Route(httpMethod: string) {
  const func: MethodDecorator = (target, key, descriptor) => {
    const fn = descriptor.value;
    BaseHandler.registerHandler(httpMethod.toUpperCase(), fn as any);
  };
  return func;
}
