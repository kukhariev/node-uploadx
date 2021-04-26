import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
import { BaseStorage, DiskStorage, DiskStorageOptions, File, UploadEventType } from '../storages';
import {
  ERRORS,
  ERROR_RESPONSES,
  getBaseUrl,
  isUploadxError,
  Logger,
  pick,
  setHeaders,
  typeis,
  UploadxError
} from '../utils';
import { Cors } from './cors';

const handlers = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'] as const;
export type Headers = Record<string, string | number>;
export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
type Handlers = typeof handlers[number];
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface BaseHandler<TFile extends Readonly<File>, L> extends EventEmitter {
  on(event: 'error', listener: (error: UploadxError) => void): this;

  on(event: UploadEventType, listener: (file: TFile) => void): this;

  off(event: UploadEventType, listener: (file: TFile) => void): this;

  off(event: 'error', listener: (error: UploadxError) => void): this;

  emit(event: UploadEventType, evt: TFile): boolean;

  emit(event: 'error', evt: UploadxError): boolean;
}

export interface SendParameters {
  statusCode?: number;
  headers?: Headers;
  body?: Record<string, any> | string;
}

export type ResponseBodyType = 'text' | 'json';

export abstract class BaseHandler<TFile extends Readonly<File>, L>
  extends EventEmitter
  implements MethodHandler {
  cors: Cors;
  responseType: ResponseBodyType = 'json';
  storage: BaseStorage<TFile, L>;
  protected log = Logger.get(this.constructor.name);
  private _registeredHandlers = new Map<string, AsyncHandler>();

  constructor(config: { storage: BaseStorage<TFile, L> } | DiskStorageOptions = {}) {
    super();
    this.cors = new Cors();
    this.storage =
      'storage' in config
        ? config.storage
        : ((new DiskStorage(config) as unknown) as BaseStorage<TFile, L>);
    this.assembleErrors();
    this.compose();
    this.log('options: %o', config);
  }

  compose(): void {
    handlers.forEach(method => {
      const handler = (this as MethodHandler)[method];
      handler && this._registeredHandlers.set(method.toUpperCase(), handler);
    });
    this.log('Handlers', this._registeredHandlers);
  }

  assembleErrors(): void {
    // TODO:
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
      return this.sendError(res, { uploadxError: ERRORS.STORAGE_ERROR });
    }
    const handler = this._registeredHandlers.get(req.method as string);
    if (handler) {
      handler
        .call(this, req, res)
        .then(async (file: TFile | L[]) => {
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
        .catch((error: UploadxError) => {
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

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    this.send(res, { statusCode: 204 });
    return {} as TFile;
  }

  /**
   * `GET` request handler
   */
  get(req: http.IncomingMessage): Promise<L[]> {
    const name = this.getName(req);
    return this.storage.get(name);
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
  sendError(res: http.ServerResponse, error: Partial<UploadxError>): void {
    if (isUploadxError(error)) {
      const [statusCode, body, headers] = ERROR_RESPONSES[error.uploadxError];
      this.send(res, { statusCode, body, headers });
    } else {
      const [statusCode, body, headers] = ERROR_RESPONSES[ERRORS.UNKNOWN_ERROR];
      this.send(res, { statusCode, body, headers });
    }
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
  protected buildFileUrl(req: http.IncomingMessage, file: TFile): string {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { pathname = '', query } = url.parse(originalUrl, true);
    const path = url.format({ pathname: `${pathname}/${file.name}`, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return `${baseUrl}${path}`;
  }
}
