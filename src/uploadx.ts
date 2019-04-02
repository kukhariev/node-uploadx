import { parse } from 'bytes';
import { EventEmitter } from 'events';
import {
  DiskStorageConfig,
  File,
  NextFunction,
  Request,
  Response,
  UploadxConfig,
  UploadXError
} from './core';
import { DiskStorage } from './disk-storage';
import { Handler } from './handler';

export interface Uploadx {
  on(event: 'error', listener: (error: UploadXError) => void): this;
  on(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'created' | 'complete' | 'deleted', listener: (file: File) => void): this;
  off(event: 'error', listener: (error: UploadXError) => void): this;
  emit(event: 'created' | 'complete' | 'deleted', file: File): boolean;
  emit(event: 'error', error: UploadXError): boolean;
}
/**
 *
 */
export class Uploadx extends EventEmitter {
  useRelativeURL: boolean = false;
  private handler: Handler;

  constructor(private options: UploadxConfig & DiskStorageConfig) {
    super();
    options.maxUploadSize = parse(options.maxUploadSize || Number.MAX_SAFE_INTEGER);
    options.storage = options.storage || new DiskStorage(options as DiskStorageConfig);
    this.handler = new Handler(this.options);
  }

  /**
   * Uploads handler
   */
  handle = (req: Request, res: Response, next?: NextFunction) => {
    Promise.resolve(this._handle_(req, res, next)).catch(next);
  };
  /**
   * Async handler
   * @internal
   */
  private _handle_ = async (req: Request, res: Response, next?: NextFunction) => {
    try {
      this.handler.setOrigin(req, res);
      switch (req.method) {
        case 'POST':
          const file = await this.handler.create(req, res);
          this.emit('created', file);
          break;
        case 'PUT':
          await this.handler.write(req, res);
          if (req.file) {
            this.emit('complete', req.file);
            next ? next() : this.handler.send(res, 200, {}, req.file!.metadata);
          }
          break;
        case 'DELETE':
          const deleted = await this.handler.delete(req, res);
          this.emit('deleted', deleted);
          next ? next() : this.handler.send(res, 200);
          break;
        case 'OPTIONS':
          this.handler.preFlight(req, res);
          break;
        default:
          this.handler.send(res, 404);
      }
    } catch (error) {
      this.emit('error', error);
      next ? next(error) : this.handler.sendError(req, res, error);
    }
  };
}
/**
 * Basic wrapper
 * @param options
 */
export function uploadx(options: UploadxConfig & DiskStorageConfig) {
  const upl = new Uploadx(options);
  return upl.handle;
}
