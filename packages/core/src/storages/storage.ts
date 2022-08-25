import * as bytes from 'bytes';
import * as http from 'http';

import {
  Cache,
  ErrorMap,
  ErrorResponses,
  ERRORS,
  fail,
  HttpError,
  isEqual,
  Locker,
  Logger,
  LogLevel,
  toMilliseconds,
  typeis,
  Validation,
  Validator,
  ValidatorConfig
} from '../utils';
import { File, FileInit, FileName, FilePart, FileQuery, isExpired, updateMetadata } from './file';
import { MetaStorage, UploadList } from './meta-storage';
import { setInterval } from 'timers';
import { ConfigHandler } from './config';

export type UserIdentifier = (req: any, res: any) => string;

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
   * Auto purging interval for expired uploads
   */
  purgeInterval?: number | string;
  /**
   * Auto prolong expiring uploads
   */
  rolling?: boolean;
}

export interface BaseStorageOptions<T extends File> {
  /** Allowed MIME types */
  allowMIME?: string[];
  /** File size limit */
  maxUploadSize?: number | string;
  /** File naming function */
  filename?: (file: T, req: any) => string;
  /** Get user identity */
  userIdentifier?: UserIdentifier;
  /** Force relative URI in Location header */
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
   * ```ts
   * app.use(
   *   '/upload',
   *   uploadx.upload({
   *     directory: 'upload',
   *     expiration: { maxAge: '6h', purgeInterval: '30min' },
   *     onComplete
   *   })
   * );
   * ```
   */
  expiration?: ExpirationOptions;
  /** Custom logger injection */
  logger?: Logger;
  /**
   * Set built-in logger severity level
   * @defaultValue 'none'
   */
  logLevel?: LogLevel;
}

const LOCK_TIMEOUT = 300; // seconds

export const locker = new Locker(1000, LOCK_TIMEOUT);

export abstract class BaseStorage<TFile extends File> {
  onComplete: (file: TFile) => Promise<any> | any;
  maxUploadSize: number;
  maxMetadataSize: number;
  path: string;
  isReady = true;
  checksumTypes: string[] = [];
  errorResponses = {} as ErrorResponses;
  cache: Cache<TFile>;
  logger: Logger;
  protected namingFunction: (file: TFile, req: any) => string;
  protected validation = new Validator<TFile>();
  abstract meta: MetaStorage<TFile>;

  protected constructor(public config: BaseStorageOptions<TFile>) {
    const configHandler = new ConfigHandler();
    const opts = configHandler.set(config);
    this.path = opts.path;
    this.onComplete = opts.onComplete;
    this.namingFunction = opts.filename;
    this.maxUploadSize = bytes.parse(opts.maxUploadSize);
    this.maxMetadataSize = bytes.parse(opts.maxMetadataSize);
    this.cache = new Cache(1000, 300);
    this.logger = opts.logger;
    if (opts.logLevel && 'logLevel' in this.logger) {
      this.logger.logLevel = opts.logLevel;
    }
    const purgeInterval = toMilliseconds(opts.expiration?.purgeInterval);
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
   * Retrieves upload metadata
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
    return { ...file };
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
      for (const { id, ...rest } of expired) {
        const [deleted] = await this.delete({ id });
        purged.items.push({ ...deleted, ...rest });
      }
      purged.items.length && this.logger.info(`Purge: removed ${purged.items.length} uploads`);
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
   * Updates user-defined metadata for an upload
   * @experimental
   */
  async update({ id }: FileQuery, { metadata }: Partial<File>): Promise<TFile> {
    const file = await this.getMeta(id);
    updateMetadata(file, metadata);
    await this.saveMeta(file);
    return { ...file, status: 'updated' };
  }

  /**
   * Prevent upload from being accessed by multiple requests
   */
  async lock(key: string): Promise<string> {
    try {
      return locker.lock(key);
    } catch {
      return fail(ERRORS.FILE_LOCKED);
    }
  }

  async unlock(key: string): Promise<void> {
    locker.unlock(key);
  }

  protected isUnsupportedChecksum(algorithm = ''): boolean {
    return !!algorithm && !this.checksumTypes.includes(algorithm);
  }

  protected startAutoPurge(purgeInterval: number): void {
    if (purgeInterval >= 2147483647) throw Error('“purgeInterval” must be less than 2147483647 ms');
    setInterval(() => void this.purge().catch(e => this.logger.error(e)), purgeInterval);
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
  abstract create(req: http.IncomingMessage, file: FileInit): Promise<TFile>;

  /**
   *  Write part and/or return status of an upload
   */
  abstract write(part: FilePart | FileQuery): Promise<TFile>;

  /**
   * Deletes an upload and its metadata
   */
  abstract delete(query: FileQuery): Promise<TFile[]>;
}
