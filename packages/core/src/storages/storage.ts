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
const MAX_FILENAME_LENGTH = 255 - METAFILE_EXTNAME.length;

export type OnComplete<TFile extends File, TResponseBody = any> = (
  file: TFile
) => Promise<TResponseBody> | TResponseBody;

export interface BaseStorageOptions<T extends File> {
  /** Allowed file types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  /** Name generator function */
  filename?: (file: T) => string;
  useRelativeLocation?: boolean;
  /** Completed callback */
  onComplete?: OnComplete<T>;
  /** Node http base path */
  path?: string;
  /** Upload validation options */
  validation?: Validation<T>;
  /** Metadata size limits */
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
  maxMetadataSize: '4MB'
};

export abstract class BaseStorage<TFile extends File, TList> {
  static maxCacheMemory = '800MB';
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = false;
  errorResponses = {} as ErrorResponses;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: TFile) => string;
  protected cache: Cache<TFile>;
  private validation = new Validator<TFile>(this.errorResponses);

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const opts: Required<BaseStorageOptions<TFile>> = { ...defaultOptions, ...config };
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;
    this.maxUploadSize = bytes.parse(opts.maxUploadSize);
    this.maxMetadataSize = bytes.parse(opts.maxMetadataSize);
    const storage = <typeof BaseStorage>this.constructor;
    this.cache = new Cache(Math.floor(bytes.parse(storage.maxCacheMemory) / this.maxMetadataSize));

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
    const filename: ValidatorConfig<TFile> = {
      isValid(file) {
        return file.name.length < MAX_FILENAME_LENGTH;
      },
      response: ERROR_RESPONSES.INVALID_FILE_NAME
    };
    this.validation.add({ size, mime, filename });
    this.validation.add({ ...opts.validation });
  }

  async validate(file: TFile): Promise<any> {
    return this.validation.verify(file);
  }

  abstract create(req: http.IncomingMessage, file: FileInit): Promise<TFile>;

  abstract write(part: FilePart): Promise<TFile>;

  abstract delete(prefix: string): Promise<TFile[]>;

  abstract get(prefix?: string): Promise<TList[]>;

  abstract update(name: string, file: Partial<File>): Promise<TFile>;
}
