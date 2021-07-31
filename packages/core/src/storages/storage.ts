import * as bytes from 'bytes';
import * as http from 'http';
import {
  Cache,
  ErrorMap,
  ErrorResponses,
  HttpError,
  Logger,
  typeis,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { File, FileInit, FilePart } from './file';

export const METAFILE_EXTNAME = '.META';

export type OnComplete<TFile extends File, TResponseBody = any> = (
  file: TFile
) => Promise<TResponseBody> | TResponseBody;

export interface BaseStorageOptions<T extends File> {
  /** Allowed MIME types */
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
  /** Metadata size limit */
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
  maxFilenameLength = 255 - METAFILE_EXTNAME.length;
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = false;
  errorResponses = {} as ErrorResponses;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: TFile) => string;
  protected cache: Cache<TFile>;
  protected validation = new Validator<TFile>();

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
      response: ErrorMap.RequestEntityTooLarge
    };

    const mime: Required<ValidatorConfig<TFile>> = {
      value: opts.allowMIME,
      isValid(file) {
        return !!typeis.is(file.contentType, this.value);
      },
      response: ErrorMap.UnsupportedMediaType
    };
    const filename: ValidatorConfig<TFile> = {
      value: this.maxFilenameLength,
      isValid(file) {
        return file.name.length < this.value;
      },
      response: ErrorMap.InvalidFileName
    };
    this.validation.add({ size, mime, filename });
    this.validation.add({ ...opts.validation });
  }

  async validate(file: TFile): Promise<any> {
    return this.validation.verify(file);
  }

  normalizeError(error: Error): HttpError {
    return {
      message: 'Generic Uploadx Error',
      statusCode: 500,
      code: 'GenericUploadxError'
    };
  }

  /**
   * Add upload to storage
   */
  abstract create(req: http.IncomingMessage, file: FileInit): Promise<TFile>;

  /**
   * Write chunks
   */
  abstract write(part: FilePart): Promise<TFile>;

  /**
   * Delete files whose path starts with the specified prefix
   * @param prefix
   */
  abstract delete(prefix: string): Promise<TFile[]>;
  /**
   * Returns files whose path starts with the specified prefix
   * @param prefix If not specified returns all files
   */
  abstract get(prefix?: string): Promise<TList[]>;

  /**
   * Update upload metadata
   */
  abstract update(name: string, file: Partial<File>): Promise<TFile>;
}
