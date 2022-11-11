import { EventEmitter } from 'events';
import * as http from 'http';
import * as url from 'url';
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
  ErrorMap,
  ErrorResponses,
  ERRORS,
  fail,
  getBaseUrl,
  hash,
  IncomingMessageWithBody,
  isUploadxError,
  isValidationError,
  Logger,
  pick,
  ResponseBodyType,
  setHeaders,
  UploadxError,
  UploadxResponse
} from '../utils';
import { Cors } from './cors';

export type AsyncHandler = (req: http.IncomingMessage, res: http.ServerResponse) => Promise<any>;
type Handlers = 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';
export type MethodHandler = {
  [h in Handlers]?: AsyncHandler;
};
type ReqEvent = { request: Pick<http.IncomingMessage, 'url' | 'headers' | 'method'> };

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
  protected _errorResponses = {} as ErrorResponses;

  constructor(config: UploadxOptions<TFile> = {}) {
    super();
    this.cors = new Cors();
    this.storage =
      'storage' in config
        ? config.storage
        : (new DiskStorage(config) as unknown as BaseStorage<TFile>);
    if (config.userIdentifier) {
      this.getUserId = config.userIdentifier;
    }
    this.logger = this.storage.logger;
    this.assembleErrors();
    this.compose();
  }

  /**
   *  Override error responses
   *  @example
   * ```ts
   *  const uploadx = new Uploadx({ storage });
   *  uploadx.errorResponses = {
   *    FileNotFound: [404, { message: 'Not Found!' }]
   *  }
   * ```
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
    this.logger.debug('Registered handlers: %s', [...this.registeredHandlers.keys()].join(', '));
  }

  assembleErrors(customErrors = {}): void {
    this._errorResponses = {
      ...ErrorMap,
      ...this._errorResponses,
      ...this.storage.errorResponses,
      ...customErrors
    };
  }

  handle = (req: http.IncomingMessage, res: http.ServerResponse): void => this.upload(req, res);

  upload = (req: http.IncomingMessage, res: http.ServerResponse, next?: () => void): void => {
    req.on('error', err => this.logger.error(`[request error]: %O`, err));
    this.cors.preflight(req, res);
    this.logger.debug(`[request]: %s %s`, req.method, req.url);
    const handler = this.registeredHandlers.get(req.method as string);
    if (!handler) {
      return this.sendError(res, { uploadxErrorCode: ERRORS.METHOD_NOT_ALLOWED } as UploadxError);
    }
    if (!this.storage.isReady) {
      return this.sendError(res, { uploadxErrorCode: ERRORS.STORAGE_ERROR } as UploadxError);
    }

    handler
      .call(this, req, res)
      .then(async (file: TFile | UploadList): Promise<void> => {
        if ('status' in file && file.status) {
          this.logger.debug(
            '[%s]: %s: %d/%d',
            file.status,
            file.name,
            file.bytesWritten,
            file.size
          );
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
          next ? next() : this.send(res, { body: file });
        }
        return;
      })
      .catch((error: Error) => {
        const err = pick(error, [
          'name',
          ...(Object.getOwnPropertyNames(error) as (keyof Error)[])
        ]) as UploadxError;
        const errorEvent = { ...err, request: pick(req, ['headers', 'method', 'url']) };
        this.listenerCount('error') && this.emit('error', errorEvent);
        this.logger.error('[error]: %O', errorEvent);
        if ('aborted' in req && req['aborted']) return;
        return this.sendError(res, error);
      });
  };

  getUserId: UserIdentifier = (req, _res) => req.user?.id || req.user?._id; // eslint-disable-line

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    this.send(res, { statusCode: 204 });
    return {} as TFile;
  }

  /**
   * Returns user uploads list
   */
  get(req: http.IncomingMessage, res: http.ServerResponse): Promise<UploadList> {
    const userId = this.getUserId(req, res);
    return userId ? this.storage.list(hash(userId)) : fail(ERRORS.FILE_NOT_FOUND);
  }

  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    { statusCode = 200, headers = {}, body = '' }: UploadxResponse
  ): void {
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
  sendError(res: http.ServerResponse, error: Error): void {
    const httpError = isUploadxError(error)
      ? this._errorResponses[error.uploadxErrorCode]
      : isValidationError(error)
      ? error
      : this.storage.normalizeError(error);
    const response = this.storage.onError(httpError);
    this.send(res, response);
  }

  /**
   * Get id from request
   */
  getId(req: http.IncomingMessage & { originalUrl?: string }): string {
    const pathname = url.parse(req.url as string).pathname || '';
    const path = req.originalUrl
      ? `/${pathname}`.replace('//', '')
      : `/${pathname}`.replace(`/${this.storage.path}/`, '');
    return path.startsWith('/') ? '' : path;
  }

  async getAndVerifyId(req: http.IncomingMessage, res: http.ServerResponse): Promise<string> {
    const uid = this.getUserId(req, res) || '';
    const id = this.getId(req);
    if (id && id.startsWith(uid && hash(uid))) return id;
    return fail(ERRORS.FORBIDDEN);
  }

  /**
   * Build file url from request
   */
  buildFileUrl(req: http.IncomingMessage & { originalUrl?: string }, file: TFile): string {
    const { query, pathname = '' } = url.parse(req.originalUrl || (req.url as string), true);
    const relative = url.format({ pathname: `${pathname as string}/${file.id}`, query });
    return this.storage.config.useRelativeLocation ? relative : getBaseUrl(req) + relative;
  }

  protected finish(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    response: UploadxResponse
  ): void {
    return this.send(res, response);
  }
}
