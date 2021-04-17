import * as bytes from 'bytes';
import * as http from 'http';
import { Cache, fail, Logger, typeis } from '../utils';
import { File, FileInit, FilePart } from './file';

export const METAFILE_EXTNAME = '.META';

type ValidationConfig<T> = {
  value: T;
  message?: string;
  statusCode?: number;
};
export type Validator = (file: File) => Required<ValidationConfig<any>> | undefined;

function validatorsParams<T>(params: T | ValidationConfig<T>): ValidationConfig<T> {
  const { value, message = '', statusCode = 0 } =
    typeof params === 'object' && 'value' in params ? params : { value: params };
  return { value, message, statusCode };
}

export type OnComplete<T extends File> = (file: T) => any;

export interface BaseStorageOptions<T extends File> {
  /** Allowed file types */
  allowMIME?: string[] | { value: string[]; message?: string; statusCode?: number };
  /** File size limit */
  maxUploadSize?:
    | number
    | string
    | { value: number | string; message?: string; statusCode?: number };
  /** Filename generator function */
  filename?: (file: T) => string;
  useRelativeLocation?: boolean;
  /** Completed callback */
  onComplete?: OnComplete<T>;
  /** Node http base path */
  path?: string;
}

const defaultOptions: Required<BaseStorageOptions<File>> = {
  allowMIME: ['*/*'],
  maxUploadSize: '5TB',
  filename: ({ userId, id }: File): string => [userId, id].filter(Boolean).join('-'),
  useRelativeLocation: false,
  onComplete: () => null,
  path: '/files'
};

export abstract class BaseStorage<TFile extends File, TList> {
  validators: Set<Validator> = new Set();
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  path: string;
  isReady = false;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: TFile) => string;
  protected cache = new Cache<TFile>();

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const opts: Required<BaseStorageOptions<TFile>> = { ...defaultOptions, ...config };
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;

    const mime = validatorsParams(opts.allowMIME);
    const fileTypeValidator: Validator = file => {
      if (!typeis.is(file.contentType, mime.value)) {
        return {
          value: mime.value,
          message: mime.message || `Acceptable file types: ${mime.value.toString()}`,
          statusCode: mime.statusCode || 415
        };
      }
      return;
    };

    const size = validatorsParams(opts.maxUploadSize);
    this.maxUploadSize = bytes.parse(size.value);
    const fileSizeValidator: Validator = file => {
      if (file.size > this.maxUploadSize) {
        return {
          value: mime.value,
          message: size.message || `File size limit: ${this.maxUploadSize}`,
          statusCode: size.statusCode || 413
        };
      }
      return;
    };

    this.validators.add(fileTypeValidator);
    this.validators.add(fileSizeValidator);
  }

  async validate(file: TFile): Promise<any> {
    for (const validator of this.validators) {
      const error = validator.call(this, file);
      if (error) return fail(error);
    }
  }

  protected setStatus(file: File): File['status'] | undefined {
    if (file.bytesWritten < file.size) return 'part';
    if (file.bytesWritten === file.size) return 'completed';
    return;
  }

  abstract create(req: http.IncomingMessage, file: FileInit): Promise<TFile>;

  abstract write(part: FilePart): Promise<TFile>;

  abstract delete(prefix: string): Promise<TFile[]>;

  abstract get(prefix?: string): Promise<TList[]>;

  abstract update(name: string, file: Partial<File>): Promise<TFile>;
}
