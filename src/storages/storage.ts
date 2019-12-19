import * as bytes from 'bytes';
import * as http from 'http';
import { Logger, typeis, fail, ERRORS, noop } from '../utils';
import { File, FilePart, FileInit } from './file';
export const DEFAULT_FILENAME = ({ userId, id }: Partial<File>): string =>
  userId ? `${userId}/${id || ''}` : `${id}`;

export const METAFILE_EXTNAME = '.META';

export interface BaseStorageOptions {
  /** Allowed file types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  /** Storage filename function */
  filename?: (file: Partial<File>) => string;
  useRelativeLocation?: boolean;

  onComplete?: (file: File) => void;
  path?: string;
}

export type ValidatorFn = (file: File) => string | false;

export abstract class BaseStorage {
  validators: Set<ValidatorFn> = new Set();
  onComplete: (file: File) => void;
  path: string;
  isReady = false;
  protected log = Logger.get(`store:${this.constructor.name}`);

  constructor(public config: BaseStorageOptions) {
    this.path = config.path ?? '/files';
    this.onComplete = config.onComplete ?? noop;
    const fileTypeLimit: ValidatorFn = file =>
      !typeis.is(file.contentType, this.config.allowMIME) &&
      `Acceptable file types: ${this.config.allowMIME}`;
    const fileSizeLimit: ValidatorFn = file =>
      file.size > bytes.parse(this.config.maxUploadSize || Number.MAX_SAFE_INTEGER) &&
      `File size limit: ${this.config.maxUploadSize}`;
    this.config.allowMIME && this.validators.add(fileTypeLimit);
    this.config.maxUploadSize && this.validators.add(fileSizeLimit);
  }

  async validate(file: File): Promise<any> {
    const errors: string[] = [];
    for (const validator of this.validators) {
      const error = validator.call(this, file);
      if (error) errors.push(error);
    }
    return errors.length ? fail(ERRORS.FILE_NOT_ALLOWED, errors.toString()) : true;
  }

  abstract create(req: http.IncomingMessage, file: FileInit): Promise<File>;
  abstract write(part: FilePart): Promise<File>;
  abstract delete(prefix: string): Promise<File[]>;
  abstract get(prefix?: string): Promise<File[]>;
  abstract update(name: string, file: Partial<File>): Promise<File>;
}
