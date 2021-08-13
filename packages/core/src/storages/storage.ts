import * as bytes from 'bytes';
import * as http from 'http';
import {
  Cache,
  ErrorMap,
  ErrorResponses,
  ERRORS,
  fail,
  HttpError,
  Logger,
  typeis,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { File, FileInit, FilePart } from './file';
import { UploadList, METAFILE_EXTNAME, MetaStorage, MetaStorageOptions } from './meta-storage';

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
  metaStorage?: MetaStorage<T>;
  metaStoragePath?: string;
  metaStorageConfig?: MetaStorageOptions;
}

const defaultOptions = {
  allowMIME: ['*/*'],
  maxUploadSize: '5TB',
  filename: ({ userId, id }: File): string => [userId, id].filter(Boolean).join('-'),
  useRelativeLocation: false,
  onComplete: () => null,
  path: '/files',
  validation: {},
  maxMetadataSize: '4MB'
};

export abstract class BaseStorage<TFile extends File> {
  static maxCacheMemory = '800MB';
  maxFilenameLength = 255 - METAFILE_EXTNAME.length;
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = false;
  errorResponses = {} as ErrorResponses;
  cache: Cache<TFile>;
  protected log = Logger.get(`store:${this.constructor.name}`);
  protected namingFunction: (file: TFile) => string;
  protected validation = new Validator<TFile>();
  abstract meta: MetaStorage<TFile>;

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const opts = { ...defaultOptions, ...config };
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

  async saveMetaFile(file: TFile): Promise<TFile> {
    this.cache.set(file.name, file);
    await this.meta.set(file.name, file);
    return file;
  }

  async deleteMetaFile(name: string): Promise<void> {
    this.cache.delete(name);
    await this.meta.remove(name);
    return;
  }

  async getMetaFile(name: string): Promise<TFile> {
    let file = this.cache.get(name);
    if (file) return file;
    try {
      file = await this.meta.get(name);
      this.cache.set(file.name, file);
      return file;
    } catch {}
    return fail(ERRORS.FILE_NOT_FOUND);
  }

  async get(prefix = ''): Promise<UploadList> {
    return this.meta.list(prefix);
  }

  /**
   * Add an upload to storage
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
   * Update upload metadata
   */
  abstract update(name: string, file: Partial<File>): Promise<TFile>;
}
