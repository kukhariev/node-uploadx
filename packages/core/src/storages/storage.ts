import * as bytes from 'bytes';
import * as http from 'http';
import { Cache, ERRORS, fail, Logger, typeis } from '../utils';
import { File, FileInit, FilePart } from './file';

export const METAFILE_EXTNAME = '.META';

type ValidatorConfig<T> = {
  value: T;
  message?: string;
  statusCode?: number;
};

export type Validator = (file: File) => Required<ValidatorConfig<any>> | false;

function validatorsParams<T>(params: T | ValidatorConfig<T>): ValidatorConfig<T> {
  return typeof params === 'object' && 'value' in params ? params : { value: params };
}

export type OnComplete<T extends File> = (file: T) => any;

export interface BaseStorageOptions<T extends File> {
  /** Allowed file types */
  allowMIME?: string[] | ValidatorConfig<string[]>;
  /** File size limit */
  maxUploadSize?: number | string | ValidatorConfig<string | number>;
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
    const fileTypeValidator: Validator = file =>
      !typeis.is(file.contentType, mime.value) && { ...ERRORS.UNSUPPORTED_MEDIA_TYPE, ...mime };

    const size = validatorsParams(opts.maxUploadSize);
    this.maxUploadSize = size.value = bytes.parse(size.value);
    const fileSizeValidator: Validator = file =>
      file.size > size.value && { ...ERRORS.REQUEST_ENTITY_TOO_LARGE, ...size };

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
