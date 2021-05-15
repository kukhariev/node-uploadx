import * as bytes from 'bytes';
import * as http from 'http';
import {
  Cache,
  ErrorResponses,
  ERROR_RESPONSES,
  Logger,
  typeis,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { File, FileInit, FilePart } from './file';

export const METAFILE_EXTNAME = '.META';

export type OnComplete<T extends File> = (file: T) => any;

export interface BaseStorageOptions<T extends File> {
  /** Allowed file types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  /** Filename generator function */
  filename?: (file: T) => string;
  useRelativeLocation?: boolean;
  /** Completed callback */
  onComplete?: OnComplete<T>;
  /** Node http base path */
  path?: string;
  validation?: Validation<T>;
  maxMetadataSize?: number | string;
}

const defaultOptions: Required<BaseStorageOptions<File>> = {
  allowMIME: ['*/*'],
  maxUploadSize: '5TB',
  filename: ({ userId, id }: File): string => [userId, id].filter(Boolean).join('-'),
  useRelativeLocation: false,
  onComplete: () => null,
  path: '/files',
  validation: {},
  maxMetadataSize: '16MB'
};

export abstract class BaseStorage<TFile extends File, TList> {
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = false;
  errorResponses = {} as ErrorResponses;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: TFile) => string;
  protected cache = new Cache<TFile>();
  private validation = new Validator<TFile>(this.errorResponses);

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const opts: Required<BaseStorageOptions<TFile>> = { ...defaultOptions, ...config };
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;
    this.maxUploadSize = bytes.parse(opts.maxUploadSize);
    this.maxMetadataSize = bytes.parse(opts.maxMetadataSize);

    const size: Required<ValidatorConfig<TFile>> = {
      value: this.maxUploadSize,
      isValid(file) {
        return file.size <= this.value;
      },
      response: ERROR_RESPONSES.REQUEST_ENTITY_TOO_LARGE
    };

    const mime: Required<ValidatorConfig<TFile>> = {
      value: opts.allowMIME,
      isValid(file) {
        return !!typeis.is(file.contentType, this.value);
      },
      response: ERROR_RESPONSES.UNSUPPORTED_MEDIA_TYPE
    };
    this.validation.add({ size, mime });
    this.validation.add({ ...opts.validation });
  }

  async validate(file: TFile): Promise<any> {
    return this.validation.verify(file);
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
