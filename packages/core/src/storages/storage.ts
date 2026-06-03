import bytes from 'bytes';
import { setInterval } from 'timers';
import { IncomingMessage, UploadxResponse } from '../types';
import {
  Cache,
  configureSimpleLogger,
  ErrorMap,
  ErrorResponses,
  ERRORS,
  fail,
  isEqual,
  Logger,
  LogLevel,
  normalizeHookResponse,
  toMilliseconds,
  typeis,
  UploadxErrorResponse,
  uploadxLogger,
  validateTimerInterval,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { ConfigHandler } from './config';
import { File, FileInit, FileName, FilePart, FileQuery, isExpired, updateMetadata } from './file';
import { MetaStorage, UploadList } from './meta-storage';

/** Returns a unique user identifier.*/
export type UserIdentifier = (req: any, res: any) => string;

/** Called when a new upload is created. Return value sent as response; use `UploadxResponse` for full control. */
export type OnCreate<T extends File = File> = (file: T) => unknown;
/** Called when an upload is updated. Return value sent as response; use `UploadxResponse` for full control. */
export type OnUpdate<T extends File = File> = (file: T) => unknown;
/** Called when an upload is completed. Return value sent as response; use `UploadxResponse` for full control. */
export type OnComplete<T extends File = File> = (file: T) => unknown;
/** Called when an upload is cancelled. Return value sent as response; use `UploadxResponse` for full control. */
export type OnDelete<T extends File = File> = (file: T) => unknown;

/** Called on upload errors. Return `UploadxResponse` to override the default error response. */
export type OnError = (error: UploadxErrorResponse) => UploadxResponse;

export type PurgeList = UploadList & { maxAgeMs: number };

export interface ExpirationOptions {
  /**
   * Age of the upload, after which it is considered expired and can be deleted
   */
  maxAge: number | string;
  /**
   * Auto purging interval for expired uploads
   */
  purgeInterval?: number | string;
  /**
   * Auto prolong expiring uploads
   */
  rolling?: boolean;
}

export interface BaseStorageOptions<T extends File> {
  /**
   * Allowed MIME types
   * @deprecated Use {@link allowedMimeTypes} instead
   */
  allowMIME?: string[];
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  /**
   * File size limit
   * @deprecated Use {@link maxFileSize} instead
   */
  maxUploadSize?: number | string;
  /** File size limit */
  maxFileSize?: number | string;
  /**
   * File naming function
   * @deprecated Use {@link namingFunction} instead
   */
  filename?: (file: T, req: any) => string;
  /** File naming function */
  namingFunction?: (file: T, req: any) => string;
  /** Returns a unique user identifier.*/
  userIdentifier?: UserIdentifier;
  /** Force relative URI in Location header */
  useRelativeLocation?: boolean;

  /** Base URL for upload endpoints. If not provided, it is determined from the request. */
  baseUrl?: string | ((req: any) => string);
  /** Called when a new upload is created */
  onCreate?: OnCreate<T>;
  /** Called when an upload is updated */
  onUpdate?: OnUpdate<T>;
  /** Called when an upload is completed */
  onComplete?: OnComplete<T>;
  /** Called when an upload is cancelled */
  onDelete?: OnDelete<T>;
  /** Called on upload errors. Return `UploadxResponse` to override the default error response. */
  onError?: OnError;
  /**
   * Node http base path
   * @deprecated Use {@link basePath} instead
   */
  path?: string;
  /** Node http base path */
  basePath?: string;
  /** Upload validation options */
  validation?: Validation<T>;
  /** Limiting the size of custom metadata */
  maxMetadataSize?: number | string;
  /** Provide custom meta storage  */
  metaStorage?: MetaStorage<T>;
  /**
   * Automatic cleaning of abandoned and completed uploads
   *
   * @example
   * ```ts
   * app.use(
   *   '/upload',
   *   uploadx.upload({
   *     uploadDir: 'upload',
   *     expiration: { maxAge: '6h', purgeInterval: '30min' },
   *     onComplete
   *   })
   * );
   * ```
   */
  expiration?: ExpirationOptions;
  /**
   * Set built-in logger severity level
   * @defaultValue 'none'
   */
  logLevel?: LogLevel;
}

export abstract class BaseStorage<TFile extends File> {
  onCreate: (file: TFile) => Promise<UploadxResponse>;
  onUpdate: (file: TFile) => Promise<UploadxResponse>;
  onComplete: (file: TFile) => Promise<UploadxResponse>;
  onDelete: (file: TFile) => Promise<UploadxResponse>;
  onError: OnError;
  maxFileSize: number;
  maxMetadataSize: number;
  basePath: string;
  isReady = true;
  checksumTypes: string[] = [];
  cache: Cache<TFile>;
  logger: Logger = uploadxLogger.getChild(this.constructor.name);
  protected validation;
  protected namingFunction: (file: TFile, req: any) => string;
  private _errorResponses: ErrorResponses = {};
  abstract meta: MetaStorage<TFile>;
  public config: Required<BaseStorageOptions<TFile>>;

  protected constructor(public options: BaseStorageOptions<TFile>) {
    // Configure the logger if a logLevel is specified
    if (options.logLevel) {
      configureSimpleLogger(options.logLevel);
    }
    const configHandler = new ConfigHandler<TFile>();
    this.config = configHandler.set(options);
    this.basePath = this.config.basePath;
    this.onCreate = normalizeHookResponse(this.config.onCreate);
    this.onUpdate = normalizeHookResponse(this.config.onUpdate);
    this.onComplete = normalizeHookResponse(this.config.onComplete);
    this.onDelete = normalizeHookResponse(this.config.onDelete);
    this.onError = this.config.onError ?? ((response: UploadxErrorResponse) => response);
    this.namingFunction = this.config.namingFunction;
    this.maxFileSize = bytes.parse(this.config.maxFileSize);
    this.maxMetadataSize = bytes.parse(this.config.maxMetadataSize);
    this.validation = new Validator<TFile>(undefined, this.errorResponses);

    this.cache = new Cache(1000, 300);
    this.logger.debug('configuration: {options}', { options });
    const purgeInterval = toMilliseconds(this.config.expiration?.purgeInterval);
    if (purgeInterval) {
      this.startAutoPurge(purgeInterval);
    }

    const size: Required<ValidatorConfig<TFile>> = {
      value: this.maxFileSize,
      isValid(file) {
        return file.size <= this.value;
      },
      response: ErrorMap.RequestEntityTooLarge
    };

    const mime: Required<ValidatorConfig<TFile>> = {
      value: this.config.allowedMimeTypes,
      isValid(file) {
        return !!typeis.is(file.contentType, this.value as string[]);
      },
      response: ErrorMap.UnsupportedMediaType
    };
    const filename: ValidatorConfig<TFile> = {
      isValid(file) {
        return FileName.isValid(file.name);
      },
      response: ErrorMap.InvalidFileName
    };
    this.validation.add({ size, mime, filename });
    this.validation.add({ ...this.config.validation });
  }

  get errorResponses(): ErrorResponses {
    return this._errorResponses;
  }

  set errorResponses(value: Partial<ErrorResponses>) {
    Object.assign(this._errorResponses, value);
  }

  async validate(file: TFile): Promise<any> {
    return this.validation.verify(file);
  }

  normalizeError(error: unknown): UploadxErrorResponse {
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
    const prev = { ...this.cache.get(file.id) };
    this.cache.set(file.id, file);
    return isEqual(prev, file, 'bytesWritten', 'expiredAt')
      ? this.meta.touch(file.id, file)
      : this.meta.save(file.id, file);
  }

  /**
   * Deletes an upload metadata
   */
  async deleteMeta(id: string): Promise<void> {
    this.cache.delete(id);
    return this.meta.delete(id);
  }

  /**
   * Retrieves upload metadata.
   *
   * @remarks
   * Returns a shallow copy — nested user metadata objects remain shared with the cache.
   */
  async getMeta(id: string): Promise<TFile> {
    let file = this.cache.get(id);
    if (!file) {
      try {
        file = await this.meta.get(id);
        this.cache.set(file.id, file);
      } catch {
        return fail(ERRORS.FILE_NOT_FOUND);
      }
    }
    return { ...file, metadata: { ...file.metadata } };
  }

  checkIfExpired(file: TFile): Promise<TFile> {
    if (isExpired(file)) {
      void this.delete(file).catch(() => null);
      return fail(ERRORS.GONE);
    }
    return Promise.resolve(file);
  }

  /**
   * Searches for and purges expired uploads
   * @param maxAge - remove uploads older than a specified age
   * @param prefix - filter uploads
   */
  async purge(maxAge?: number | string, prefix?: string): Promise<PurgeList> {
    const maxAgeMs = toMilliseconds(maxAge || this.config.expiration?.maxAge);
    const purged = { items: [], maxAgeMs, prefix } as PurgeList;
    if (maxAgeMs) {
      const before = Date.now() - maxAgeMs;
      const expired = (await this.list(prefix)).items.filter(
        item =>
          +new Date(
            this.config.expiration?.rolling ? item.modifiedAt || item.createdAt : item.createdAt
          ) < before
      );
      let errorCount = 0;
      const total = expired.length;
      for (const { id, ...rest } of expired) {
        const [deleted] = await this.delete({ id });
        if (deleted.status !== 'deleted') {
          errorCount++;
        }
        purged.items.push({ ...deleted, ...rest });
      }
      const successCount = total - errorCount;
      if (successCount > 0) {
        this.logger.info(`Purge: removed ${successCount} uploads`);
      }
      if (errorCount > 0) {
        this.logger.warn('Purge: {errorCount} out of {total} uploads had non‑deleted status', {
          errorCount,
          total
        });
      }
    }
    return purged;
  }

  async get({ id }: FilePart): Promise<UploadList> {
    return this.meta.list(id);
  }

  /**
   * Retrieves a list of uploads whose names begin with the prefix
   * @experimental
   */
  async list(prefix = ''): Promise<UploadList> {
    return this.meta.list(prefix);
  }

  /**
   * Set user-provided metadata as key-value pairs
   * @experimental
   */
  async update({ id }: FileQuery, metadata: Partial<File>): Promise<TFile> {
    const file = await this.getMeta(id);
    updateMetadata(file, metadata);
    await this.saveMeta(file);
    return { ...file, status: 'updated' };
  }

  protected isUnsupportedChecksum(algorithm = ''): boolean {
    return !!algorithm && !this.checksumTypes.includes(algorithm);
  }

  protected startAutoPurge(purgeInterval: number): void {
    validateTimerInterval(purgeInterval, 'purgeInterval');
    setInterval(
      () => void this.purge().catch(e => this.logger.error('purge error: {e}', { e })),
      purgeInterval
    ).unref();
  }

  protected updateTimestamps(file: TFile): TFile {
    file.createdAt ??= new Date().toISOString();
    const maxAgeMs = toMilliseconds(this.config.expiration?.maxAge);
    if (maxAgeMs) {
      file.expiredAt = this.config.expiration?.rolling
        ? new Date(Date.now() + maxAgeMs).toISOString()
        : new Date(+new Date(file.createdAt) + maxAgeMs).toISOString();
    }
    return file;
  }

  /**
   *  Creates a new upload and saves its metadata
   */
  abstract create(req: IncomingMessage, file: FileInit): Promise<TFile>;

  /**
   *  Write part and/or return status of an upload
   */
  abstract write(part: FilePart | FileQuery): Promise<TFile>;

  /**
   * Deletes an upload and its metadata
   */
  abstract delete(query: FileQuery): Promise<TFile[]>;
}
