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
    options.maxChunkSize = parse(options.maxChunkSize || Number.MAX_SAFE_INTEGER);
    options.storage = options.storage || new DiskStorage(options as DiskStorageConfig);
    this.handler = new Handler(this.options);
  }

  /**
   * Uploads handler
   */
  handle = (req: Request, res: Response, next?: NextFunction) => {
    Promise.resolve(this.handler.handle(req, res, next)).catch(next);
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
