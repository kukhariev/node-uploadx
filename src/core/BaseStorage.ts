import * as http from 'http';
import { File, FilePart } from './';
import { typeis } from '../utils';
import bytes = require('bytes');
export interface StorageOptions {
  allowMIME?: string[];
  maxUploadSize?: number | string;
  useRelativeLocation?: boolean;
}

export type ValidatorFn = (file: File) => string | false;
function fileTypeLimit(this: BaseStorage, file: File): string | false {
  return !typeis.is(file.mimeType, this.config.allowMIME) && `The filetype is not allowed`;
}
function fileSizeLimit(this: BaseStorage, file: File): string | false {
  return (
    file.size > bytes.parse(this.config.maxUploadSize || Number.MAX_SAFE_INTEGER) &&
    `File size limit: ${this.config.maxUploadSize}`
  );
}
export abstract class BaseStorage {
  validators: Set<ValidatorFn> = new Set();
  constructor(public config: StorageOptions) {
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
  abstract write(req: http.IncomingMessage, range: FilePart): Promise<File>;
  abstract delete(file: Partial<File>): Promise<File[]>;
  abstract get(file: Partial<File>): Promise<File[]>;
}
