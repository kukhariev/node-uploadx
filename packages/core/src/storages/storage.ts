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
  toMilliseconds,
  typeis,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { File, FileInit, FileName, FilePart, isExpired, updateMetadata } from './file';
import { MetaStorage, UploadList } from './meta-storage';
import { setInterval } from 'timers';

export type OnComplete<TFile extends File, TResponseBody = any> = (
  file: TFile
) => Promise<TResponseBody> | TResponseBody;

export type PurgeList = UploadList & { maxAgeMs: number };

export interface ExpirationOptions {
  /**
   * Age of the upload, after which it is considered expired and can be deleted
   */
  maxAge: number | string;
  /**
   * Send `410 Gone` if the client tries to resume an expired upload
   */
  errorIfExpired?: boolean;
  /**
   * Auto purging interval for expired uploads
   */
  purgeInterval?: number | string;
}

export interface BaseStorageOptions<T extends File> {
  /** Allowed MIME types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  userIdentifier?: (req: any) => string;
  /** Name generator function */
  filename?: (file: T, req: any) => string;
  useRelativeLocation?: boolean;
  /** Completed callback */
  onComplete?: OnComplete<T>;
  /** Node http base path */
  path?: string;
  /** Upload validation options */
  validation?: Validation<T>;
  /** Limiting the size of custom metadata */
  maxMetadataSize?: number | string;
  /** Provide custom meta storage  */
  metaStorage?: MetaStorage<T>;
  /**
   * Automatic cleaning of abandoned and completed uploads
   * @example
   app.use(
     '/upload',
     uploadx.upload({
      directory: 'upload',
      expiration: { maxAge: '6h', purgeInterval: '30min' },
      onComplete
    })
   );
   */
  expiration?: ExpirationOptions;
}

const defaultOptions = {
  allowMIME: ['*/*'],
  maxUploadSize: '5TB',
  filename: ({ id }: File): string => id,
  useRelativeLocation: false,
  onComplete: () => null,
  path: '/files',
  validation: {},
  maxMetadataSize: '4MB'
};

export abstract class BaseStorage<TFile extends File> {
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = true;
  errorResponses = {} as ErrorResponses;
  cache: Cache<TFile>;
  protected log = Logger.get(`${this.constructor.name}`);
  protected namingFunction: (file: TFile, req: any) => string;
  protected validation = new Validator<TFile>();
  abstract meta: MetaStorage<TFile>;

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const opts = { ...defaultOptions, ...config };
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;
    this.maxUploadSize = bytes.parse(opts.maxUploadSize);
    this.maxMetadataSize = bytes.parse(opts.maxMetadataSize);
    this.cache = new Cache();

    const purgeInterval = toMilliseconds(this.config.expiration?.purgeInterval);
    if (purgeInterval) {
      this.startAutoPurge(purgeInterval);
    }

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
      isValid(file) {
        return FileName.isValid(file.name) && FileName.isValid(file.originalName);
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
   * Saves upload metadata
   */
  async saveMeta(file: TFile): Promise<TFile> {
    this.updateTimestamps(file);
    this.cache.set(file.name, file);
    return this.meta.save(file.name, file);
  }

  /**
   * Deletes an upload metadata
   */
  async deleteMeta(name: string): Promise<void> {
    this.cache.delete(name);
    return this.meta.delete(name);
  }

  /**
   * Retrieves upload metadata
   */
  async getMeta(name: string): Promise<TFile> {
    let file = this.cache.get(name);
    if (!file) {
      try {
        file = await this.meta.get(name);
        this.cache.set(file.name, file);
      } catch {
        return fail(ERRORS.FILE_NOT_FOUND);
      }
    }
    return file;
  }

  checkIfExpired(file: TFile): Promise<TFile> {
    return (this.config.expiration?.errorIfExpired || this.config.expiration?.purgeInterval) &&
      isExpired(file)
      ? fail(ERRORS.GONE)
      : Promise.resolve(file);
  }

  /**
   * Searches for and purges expired uploads
   * @param maxAge Remove uploads older than a specified age
   * @param prefix Filter uploads
   */
  async purge(maxAge?: number | string, prefix?: string): Promise<PurgeList> {
    const maxAgeMs = toMilliseconds(maxAge || this.config.expiration?.maxAge);
    const purged = { items: [], maxAgeMs, prefix } as PurgeList;
    if (maxAgeMs) {
      const before = Date.now() - maxAgeMs;
      const entries = (await this.list(prefix)).items.filter(
        item => +new Date(item.createdAt) < before
      );
      for (const { name, createdAt } of entries) {
        const [deleted] = await this.delete(name);
        purged.items.push({ ...deleted, createdAt });
      }
    }
    purged.items.length && this.log(`Purge: removed ${purged.items.length} uploads`);
    return purged;
  }

  async get(req: http.IncomingMessage, prefix = ''): Promise<UploadList> {
    const user = this.getUserIdentifier(req);
    if (!user) return fail(ERRORS.FILE_NOT_FOUND);
    const uploadList: UploadList = { items: [], prefix };
    const list = await this.list(prefix);
    for (const item of list.items) {
      const { createdAt, expiredAt, name, size, userId } = await this.getMeta(item.name);
      user === userId &&
        uploadList.items.push({ createdAt, expiredAt, name, size, userId } as Required<File>);
    }
    return uploadList;
  }

  /**
   * Retrieves a list of uploads whose names begin with the prefix
   * @experimental
   */
  async list(prefix = ''): Promise<UploadList> {
    return this.meta.list(prefix);
  }

  /**
   * Update user-provided metadata
   * @experimental
   * @todo Metadata size limit
   */
  async update(name: string, { metadata }: Partial<File>): Promise<TFile> {
    const file = await this.getMeta(name);
    updateMetadata(file, metadata);
    await this.saveMeta(file);
    return { ...file, status: 'updated' };
  }

  protected startAutoPurge(purgeInterval: number): void {
    if (purgeInterval >= 2147483647) throw Error('“purgeInterval” must be less than 2147483647 ms');
    setInterval(() => void this.purge().catch(this.log), purgeInterval);
  }

  protected updateTimestamps(file: TFile): TFile {
    file.createdAt ??= new Date().toISOString();
    const maxAgeMs = toMilliseconds(this.config.expiration?.maxAge);
    if (maxAgeMs) {
      file.expiredAt = new Date(+new Date(file.createdAt) + maxAgeMs).toISOString();
    }
    return file;
  }

  protected getUserIdentifier(req: http.IncomingMessage): string {
    return this.config.userIdentifier instanceof Function ? this.config.userIdentifier(req) : '';
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
   */
  abstract delete(prefix: string): Promise<TFile[]>;
}
