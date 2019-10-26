import * as bytes from 'bytes';
import * as http from 'http';
import { typeis } from './utils';
import { File, FilePart } from '.';
import { Readable } from 'stream';

export interface StorageOptions {
  /** Allowed file types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  useRelativeLocation?: boolean;
  /** Unfinished uploads expire in days*/
  expire?: number;
  // path?: string;
}

export type ValidatorFn = (file: File) => string | false;

export abstract class BaseStorage {
  validators: Set<ValidatorFn> = new Set();

  constructor(public config: StorageOptions) {
    const fileTypeLimit: ValidatorFn = file =>
      !typeis.is(file.mimeType, this.config.allowMIME) &&
      `Acceptable file types: ${this.config.allowMIME}`;
    const fileSizeLimit: ValidatorFn = file =>
      file.size > bytes.parse(this.config.maxUploadSize || Number.MAX_SAFE_INTEGER) &&
      `File size limit: ${this.config.maxUploadSize}`;
    this.config.allowMIME && this.validators.add(fileTypeLimit);
    this.config.maxUploadSize && this.validators.add(fileSizeLimit);
  }

  validate(file: File): string[] {
    const errors: string[] = [];
    for (const validator of this.validators) {
      const error = validator.call(this, file);
      if (error) errors.push(error);
    }
    return errors;
  }

  abstract create(req: http.IncomingMessage, file: File): Promise<File>;
  abstract write(stream: Readable, range: FilePart): Promise<File>;
  abstract delete(file: Partial<File>): Promise<File[]>;
  abstract get(file: Partial<File>): Promise<File[]>;
}
