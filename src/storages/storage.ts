import * as bytes from 'bytes';
import * as http from 'http';
import { ERRORS, fail, Logger, typeis } from '../utils';
import { File, FileInit, FilePart } from './file';

export const METAFILE_EXTNAME = '.META';

export interface BaseStorageOptions {
  /** Allowed file types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  /** Filename generator function */
  filename?: (file: Partial<File>) => string;
  useRelativeLocation?: boolean;
  /** Completed callback */
  onComplete?: (file: File) => void;
  /** Node http base path */
  path?: string;
}

const defaultOptions: Required<BaseStorageOptions> = {
  allowMIME: ['*/*'],
  maxUploadSize: '50GB',
  filename: ({ userId, id }: Partial<File>): string => [userId, id].filter(Boolean).join('-'),
  useRelativeLocation: false,
  onComplete: () => undefined,
  path: '/files'
};

export type Validator = (file: File) => string | false;

export abstract class BaseStorage<TFile, TList> {
  validators: Set<Validator> = new Set();
  onComplete: (file: File) => void;
  path: string;
  isReady = false;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: Partial<File>) => string;
  constructor(public config: BaseStorageOptions) {
    const opts: Required<BaseStorageOptions> = { ...defaultOptions, ...config };
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;
    const fileTypeLimit: Validator = file =>
      !typeis.is(file.contentType, opts.allowMIME) && `Acceptable file types: ${opts.allowMIME}`;
    const fileSizeLimit: Validator = file =>
      file.size > bytes.parse(opts.maxUploadSize) && `File size limit: ${opts.maxUploadSize}`;
    this.validators.add(fileTypeLimit);
    this.validators.add(fileSizeLimit);
  }

  async validate(file: File): Promise<any> {
    const errors: string[] = [];
    for (const validator of this.validators) {
      const error = validator.call(this, file);
      if (error) errors.push(error);
    }
    return errors.length ? fail(ERRORS.FILE_NOT_ALLOWED, errors.toString()) : true;
  }

  protected setStatus(file: File): File['status'] {
    if (file.bytesWritten < file.size) {
      return 'part';
    } else if (file.bytesWritten === file.size) {
      return 'completed';
    }
    return;
  }

  abstract create(req: http.IncomingMessage, file: FileInit): Promise<TFile>;
  abstract write(part: FilePart): Promise<TFile>;
  abstract delete(prefix: string): Promise<TFile[]>;
  abstract get(prefix?: string): Promise<TList[]>;
  abstract update(name: string, file: Partial<File>): Promise<TFile>;
}
