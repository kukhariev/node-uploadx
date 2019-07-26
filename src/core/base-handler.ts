import * as http from 'http';
import { File, UploadxConfig } from './interfaces';
import { BaseStorage, UploadXError, ERRORS } from './';
import { parse } from 'bytes';
import { EventEmitter } from 'events';
export interface BaseHandler {
  on(event: 'error', listener: (error: UploadXError) => void): this;
  on(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: UploadXError) => void): this;
  emit(event: 'created' | 'complete' | 'deleted', file: File): boolean;
  emit(event: 'error', error: UploadXError): boolean;
}
export abstract class BaseHandler extends EventEmitter {
  private readonly mimeRegExp = new RegExp((this.options.allowMIME || [`\/`]).join('|'));
  allowedMethods = ['GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD'];
  allowedHeaders = '';
  corsMaxAge = 600;
  withCredentials = false;
  /**
   * Where store files
   */
  storage: BaseStorage;

  constructor(public options: UploadxConfig) {
    super();
    options.maxUploadSize = parse(options.maxUploadSize || Number.MAX_SAFE_INTEGER);
    options.maxChunkSize = parse(options.maxChunkSize || Number.MAX_SAFE_INTEGER);
    this.storage = options.storage as BaseStorage;
  }

  protected getUserId(req: any): string {
    return 'user' in req ? req.user.id || req.user._id : '';
  }
  /**
   * Create file
   */
  abstract create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | File;
  /**
   * Chunks
   */
  abstract write(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | void;
  /**
   * Delete by id
   */
  abstract delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> | File;
  /**
   * Make formated httpError response
   */
  abstract sendError(req: http.IncomingMessage, res: http.ServerResponse, error: any): void;

  validateFile(file: File) {
    if (!this.mimeRegExp.test(file.mimeType)) throw new UploadXError(ERRORS.FILE_TYPE_NOT_ALLOWED);
    if (isNaN(file.size)) throw new UploadXError(ERRORS.INVALID_FILE_SIZE);
    if (file.size > this.options.maxUploadSize!)
      throw new UploadXError(ERRORS.FILE_TOO_LARGE, `Max file size: ${this.options.maxUploadSize}`);
  }
  /**
   * Set Origin header
   * @internal
   */
  setOrigin(req: http.IncomingMessage, res: http.ServerResponse) {
    req.headers.origin && this.setHeader(res, 'Access-Control-Allow-Origin', req.headers.origin);
    this.withCredentials && this.setHeader(res, 'Access-Control-Allow-Credentials', 'true');
  }

  /**
   * OPTIONS preflight Request
   */
  preFlight(req: http.IncomingMessage, res: http.ServerResponse) {
    const allowedHeaders = this.allowedHeaders || req.headers['access-control-request-headers']!;
    this.setHeader(res, 'Access-Control-Allow-Methods', this.allowedMethods.join(','));
    this.setHeader(res, 'Access-Control-Allow-Headers', allowedHeaders);
    this.setHeader(res, 'Access-Control-Max-Age', this.corsMaxAge);
    res.setHeader('Content-Length', '0');
    res.writeHead(204);
    res.end();
  }

  private setHeader(res: http.ServerResponse, name: string, value: string | string[] | number) {
    !res.hasHeader(name) && res.setHeader(name, value);
  }
  /**
   * Make response
   */
  send(
    res: http.ServerResponse,
    statusCode: number,
    headers = {},
    body?: { [key: string]: any } | string | undefined
  ) {
    const json = typeof body === 'object';
    const data = json ? JSON.stringify(body) : (body as string) || '';
    res.setHeader('Content-Length', Buffer.byteLength(data));
    res.setHeader('Cache-Control', 'no-store');
    json && data && res.setHeader('Content-Type', 'application/json');
    res.writeHead(statusCode, headers);
    res.end(data);
  }
}
