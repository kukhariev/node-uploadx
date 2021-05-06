import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
import { BaseStorage, DiskStorage, DiskStorageOptions, File, UploadEventType } from '../storages';
import {
  ERROR_RESPONSES,
  ErrorResponses,
  ERRORS,
  getBaseUrl,
  Logger,
  pick,
  setHeaders,
  typeis,
  UploadxError
} from '../utils';
import { Cors } from './cors';

export type Headers = Record<string, string | number>;
export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
type Handlers = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
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
  /**
   * Limiting enabled http method handlers
   * @example
   * Uploadx.methods = ['post', 'put', 'delete'];
   * app.use('/upload', uploadx(opts));
   *
   */
  static methods: Handlers[] = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'];
  cors: Cors;
  responseType: ResponseBodyType = 'json';
  storage: BaseStorage<TFile, L>;
  registeredHandlers = new Map<string, AsyncHandler>();
  protected log = Logger.get(this.constructor.name);
  private _errorResponses = {} as ErrorResponses;

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

  /**
   *  Override error responses
   *  @example
   *  const uploadx = new Uploadx({ storage });
   *  uploadx.errorResponses = {
   *    FILE_NOT_FOUND: [404, { error: 'Not Found!' }]
   *  }
   * @param value
   */
  set errorResponses(value: Partial<ErrorResponses>) {
    this.assembleErrors(value);
  }

  compose(): void {
    const child = <typeof BaseHandler>this.constructor;
    (child.methods || BaseHandler.methods).forEach(method => {
      const handler = (this as MethodHandler)[method];
      handler && this.registeredHandlers.set(method.toUpperCase(), handler);
      // handler && this.cors.allowedMethods.push(method.toUpperCase());
    });
    this.log('Handlers', this.registeredHandlers);
  }

  assembleErrors(value = {}): void {
    this._errorResponses = {
      ...ERROR_RESPONSES,
      ...value,
      ...this.storage.errorResponses
    };
  }

  handle = (req: http.IncomingMessage, res: http.ServerResponse): void => this.upload(req, res);

  upload = (
    req: http.IncomingMessage & { body?: any; _body?: boolean },
    res: http.ServerResponse,
    next?: () => void
  ): void => {
    req.on('error', err => this.log(`[request error]: %o`, err));
    this.log(`[request]: %s`, req.method, req.url);
    const handler = this.registeredHandlers.get(req.method as string);
    if (!handler) {
      return this.sendError(res, { uploadxError: ERRORS.METHOD_NOT_ALLOWED });
    }
    if (!this.storage.isReady) {
      return this.sendError(res, { uploadxError: ERRORS.STORAGE_ERROR });
    }
    this.cors.preflight(req, res);

    handler
      .call(this, req, res)
      .then(
        async (file: TFile | L[]): Promise<void> => {
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
        }
      )
      .catch((error: UploadxError) => {
        const errorEvent: UploadxError = Object.assign(error, {
          request: pick(req, ['headers', 'method', 'url'])
        });
        this.listenerCount('error') && this.emit('error', errorEvent);
        this.log('[error]: %o', errorEvent);
        if ('aborted' in req && req['aborted']) return;
        typeis.hasBody(req) > 1e6 && res.setHeader('Connection', 'close');
        return this.sendError(res, error);
      });
  };

  // eslint-disable-next-line
  getUserId = (req: any, _res: any): string | undefined => req.user?.id || req.user?._id;

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
    const [statusCode, body, headers] = this._errorResponses[
      error.uploadxError || ERRORS.UNKNOWN_ERROR
    ];
    this.send(res, { statusCode, body, headers });
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
