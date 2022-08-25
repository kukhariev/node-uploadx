import { FileName } from './file';
import { logger, Logger } from '../utils';

/** @experimental */
export interface UploadListEntry {
  /** upload id */
  id: string;
  createdAt: string | Date | number;
  expiredAt?: string | Date | number;
  modifiedAt?: string | Date | number;
}

/** @experimental */
export interface UploadList {
  items: UploadListEntry[];
  prefix?: string;
}

export interface MetaStorageOptions {
  prefix?: string;
  suffix?: string;
  logger?: Logger;
}

/**
 * Stores upload metadata
 */
export class MetaStorage<T> {
  prefix = '';
  suffix = '';
  logger: Logger;

  constructor(config?: MetaStorageOptions) {
    this.prefix = config?.prefix || '';
    this.suffix = config?.suffix || METAFILE_EXTNAME;
    this.prefix && FileName.INVALID_PREFIXES.push(this.prefix);
    this.suffix && FileName.INVALID_SUFFIXES.push(this.suffix);
    this.logger = config?.logger || logger;
  }

  /**
   * Saves upload metadata
   */
  async save(id: string, file: T): Promise<T> {
    return file;
  }

  /**
   * Deletes an upload metadata
   */
  async delete(id: string): Promise<void> {
    return;
  }

  /**
   * Retrieves upload metadata
   */
  async get(id: string): Promise<T> {
    return Promise.reject();
  }

  /**
   * Mark upload active
   */
  async touch(id: string, file: T): Promise<T> {
    return file;
  }

  /**
   * Retrieves a list of uploads whose names begin with the prefix
   * @experimental
   */
  async list(prefix = ''): Promise<UploadList> {
    return { items: [] };
  }

  getMetaName(id: string): string {
    return this.prefix + id + this.suffix;
  }

  getIdFromMetaName(name: string): string {
    return name.slice(this.prefix.length, -this.suffix.length);
  }
}

/**
 * @deprecated Use MetaStorage.suffix instead
 */
export const METAFILE_EXTNAME = '.META';
