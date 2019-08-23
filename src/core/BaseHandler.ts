import * as bytes from 'bytes';
import { EventEmitter } from 'events';
import * as http from 'http';
import { ERRORS, ErrorStatus, fail } from '.';
import { logger, typeis, pick } from '../utils';
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
  userId: string;
}

export interface BaseConfig {
  storage?: BaseStorage;
  allowMIME?: string[];
  maxUploadSize?: number | string;
  useRelativeLocation?: boolean;
}
const handlers = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;
type Handlers = typeof handlers[number];
export const REQUEST_METHODS = handlers.map(s => s.toUpperCase());
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};
export interface BaseHandler extends EventEmitter {
  on(event: 'error', listener: (error: ErrorStatus) => void): this;
  on(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'completed' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: ErrorStatus) => void): this;
  emit(event: 'created' | 'completed' | 'deleted', evt: File): boolean;
  emit(event: 'error', evt: ErrorStatus): boolean;
}

export class BaseHandler extends EventEmitter implements MethodHandler {
  options?: AsyncHandler;
  responseType: 'text' | 'json' = 'text';
  private __registeredHandlers: Map<string, AsyncHandler> = new Map();
  constructor(public config: BaseConfig) {
    super();
    this.registerHandlers();
  }
  registerHandlers() {
    handlers.forEach(method => {
      const enabled = (this as MethodHandler)[method];
      if (enabled) {
        this.__registeredHandlers.set(method.toUpperCase(), enabled);
      }
    });
    log('Handlers', this.__registeredHandlers);
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
    const handler = this.__registeredHandlers.get(req.method as string);
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
