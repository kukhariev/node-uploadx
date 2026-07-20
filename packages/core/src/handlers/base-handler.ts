import { EventEmitter } from 'events';
import {
  BaseStorage,
  DiskStorage,
  DiskStorageOptions,
  UploadList,
  UploadxEventType,
  UploadxFile,
  UserIdentifier
} from '../storages';
import {
  IncomingMessage,
  IncomingMessageWithBody,
  ResponseBodyType,
  ServerResponse,
  UploadxResponse
} from '../types';
import {
  ErrorMap,
  ErrorResponses,
  ERRORS,
  fail,
  getBaseUrl,
  isUploadxError,
  Logger,
  pick,
  setHeaders,
  tokenize,
  UploadxError,
  uploadxLogger
} from '../utils';
import { Cors } from './cors';

type Handlers = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
export type AsyncHandler = (req: IncomingMessage, res: ServerResponse) => Promise<any>;
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};

type ReqEvent = { request: Pick<IncomingMessage, 'url' | 'headers' | 'method'> };
export type UploadxEvent<TFile extends UploadxFile> = TFile & ReqEvent;
export type UploadxErrorEvent = UploadxError & ReqEvent;

export interface BaseHandler<TFile extends UploadxFile> extends EventEmitter {
  on(event: 'error', listener: (error: UploadxErrorEvent) => void): this;

  on(event: UploadxEventType, listener: (payload: UploadxEvent<TFile>) => void): this;

  off(event: UploadxEventType, listener: (payload: UploadxEvent<TFile>) => void): this;

  off(event: 'error', listener: (error: UploadxErrorEvent) => void): this;

  emit(event: UploadxEventType, payload: UploadxEvent<TFile>): boolean;

  emit(event: 'error', error: UploadxErrorEvent): boolean;
}

export type UploadxOptions<TFile extends UploadxFile> =
  | { storage: BaseStorage<TFile>; userIdentifier?: UserIdentifier }
  | DiskStorageOptions;

export abstract class BaseHandler<TFile extends UploadxFile>
  extends EventEmitter
  implements MethodHandler
{
  /**
   * Limiting enabled http method handlers
   * @example
   * ```ts
   * Uploadx.methods = ['post', 'put', 'delete'];
   * app.use('/upload', uploadx(opts));
   * ```
   */
  static methods: Handlers[] = ['delete', 'get', 'head', 'options', 'patch', 'post', 'put'];
  cors: Cors;
  responseType: ResponseBodyType = 'json';
  storage: BaseStorage<TFile>;
  registeredHandlers = new Map<string, AsyncHandler>();
  logger: Logger;
  constructor(options: UploadxOptions<TFile> = {}) {
    super();
    this.cors = new Cors();
    this.storage =
      'storage' in options
        ? options.storage
        : (new DiskStorage(options) as unknown as BaseStorage<TFile>);
    if (options.userIdentifier) {
      this.getUserId = options.userIdentifier;
    }
    this.logger = uploadxLogger.getChild(this.constructor.name);
    this.compose();
  }

  set errorResponses(value: Partial<ErrorResponses>) {
    Object.assign(this.storage.errorResponses, value);
  }

  compose(): void {
    const child = <typeof BaseHandler>this.constructor;
    (child.methods || BaseHandler.methods).forEach(method => {
      const handler = (this as MethodHandler)[method];
      handler && this.registeredHandlers.set(method.toUpperCase(), handler.bind(this));
      // handler && this.cors.allowedMethods.push(method.toUpperCase());
    });
    this.logger.debug(`registered handlers: ${[...this.registeredHandlers.keys()].join(', ')}`);
  }

  handle = (req: IncomingMessage, res: ServerResponse): void => this.upload(req, res);

  upload = (req: IncomingMessage, res: ServerResponse, next?: () => void): void => {
    if (this.cors.preflight(req, res)) {
      res.writeHead(204, { 'Content-Length': 0 }).end();
      return;
    }
    if (this.storage.config.basePath) {
      const { pathname } = new URL(req.originalUrl || req.url || '', 'http://localhost');
      const basePath = this.storage.basePath;
      const match =
        basePath === '/' || pathname === basePath || pathname.startsWith(`${basePath}/`);
      if (!match) return this.sendError(res, new UploadxError(ERRORS.FILE_NOT_FOUND));
    }
    req.on('error', err => this.logger.error('Request error', { err }));
    this.logger.debug('Request {method} {url}', { method: req.method, url: req.url });
    const handler = this.registeredHandlers.get(req.method as string);
    if (!handler) {
      return this.sendError(res, new UploadxError(ERRORS.METHOD_NOT_ALLOWED));
    }
    if (!this.storage.isReady) {
      return this.sendError(res, new UploadxError(ERRORS.STORAGE_ERROR));
    }

    handler(req, res)
      .then(async (file: TFile | UploadList): Promise<void> => {
        if ('status' in file && file.status) {
          this.logger.debug('Upload {status}: {name} {bytesWritten}/{size}', {
            status: file.status,
            name: file.name,
            bytesWritten: file.bytesWritten,
            size: file.size
          });
          this.listenerCount(file.status) &&
            this.emit(file.status, { ...file, request: pick(req, ['headers', 'method', 'url']) });
          if (file.status === 'completed') {
            if (next) {
              (req as IncomingMessageWithBody)['_body'] = true;
              (req as IncomingMessageWithBody)['body'] = file;
              next();
            } else {
              const completed = await this.storage.onComplete(file);
              this.finish(req, res, completed);
            }
          }
          return;
        }
        if (req.method === 'GET') {
          (req as IncomingMessageWithBody)['body'] = file;
          next ? next() : this.send(res, { statusCode: 200, body: file });
        }
        return;
      })
      .catch(err => {
        const errorPayload = {
          ...pick(err, Object.getOwnPropertyNames(err) as (keyof Error)[]),
          request: pick(req, ['headers', 'method', 'url'])
        };
        this.listenerCount('error') && this.emit('error', errorPayload as UploadxErrorEvent);
        this.logger.error('{errorPayload.message} {*}', { errorPayload });
        if ('aborted' in req && req['aborted']) return;
        return this.sendError(res, err);
      });
  };

  getUserId: UserIdentifier = (req, _res) => req.user?.id || req.user?._id; // eslint-disable-line

  async options(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    this.send(res, { statusCode: 204 });
    return {} as TFile;
  }

  /**
   * Returns user uploads list
   */
  get(req: IncomingMessage, res: ServerResponse): Promise<UploadList> {
    const userId = this.getUserId(req, res);
    return userId ? this.storage.list(tokenize(userId)) : fail(ERRORS.FILE_NOT_FOUND);
  }

  /**
   * Make response
   */
  send(res: ServerResponse, { statusCode = 200, headers = {}, body = '' }: UploadxResponse): void {
    setHeaders(res, headers);
    let data: string;
    if (typeof body !== 'string') {
      data = JSON.stringify(body);
      if (!headers['Content-Type']) res.setHeader('Content-Type', 'application/json');
    } else {
      data = body;
    }
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    res.writeHead(statusCode);
    res.end(data);
  }

  /**
   * Send Error to client
   */
  sendError(res: ServerResponse, error: unknown): void {
    let info;
    if (isUploadxError(error)) {
      info = this.storage.errorResponses[error.uploadxErrorCode] ??
        ErrorMap[error.uploadxErrorCode as ERRORS] ?? {
          code: error.uploadxErrorCode,
          message: error.message,
          statusCode: 500,
          cause: error.cause
        };
    } else {
      info = this.storage.normalizeError(error);
    }
    const response = { ...this.storage.onError(info) };
    if (!response.body) {
      response.body = { error: { code: info.code, message: info.message } };
    }
    this.send(res, response);
  }

  /**
   * Get id from request
   */
  getId(req: IncomingMessage): string {
    const { pathname } = new URL(req.url || '', 'http://localhost');
    const path = req.originalUrl
      ? `/${pathname}`.replace('//', '')
      : `/${pathname}`.replace(`/${this.storage.basePath}/`, '');
    return path.startsWith('/') ? '' : path;
  }

  async getAndVerifyId(req: IncomingMessage, res: ServerResponse): Promise<string> {
    const uid = this.getUserId(req, res) || '';
    const id = this.getId(req);
    if (id && id.startsWith(tokenize(uid))) return id;
    return fail(ERRORS.FORBIDDEN);
  }

  /**
   * Build file url from request
   */
  buildFileUrl(req: IncomingMessage, file: TFile): string {
    const requestUrl = new URL(req.originalUrl || req.url || '', 'http://localhost');
    const relative = `${requestUrl.pathname}/${file.id}${requestUrl.search}`;
    if (this.storage.config.useRelativeLocation) return relative;
    const { baseUrl } = this.storage.config;
    const base = typeof baseUrl === 'function' ? baseUrl(req) : baseUrl || getBaseUrl(req);
    return base + relative;
  }

  protected finish(req: IncomingMessage, res: ServerResponse, response: UploadxResponse): void {
    return this.send(res, response);
  }
}
