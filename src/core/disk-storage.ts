import * as Configstore from 'configstore';
import * as fs from 'fs';
import * as http from 'http';
import { join, normalize } from 'path';
import { Readable } from 'stream';
import { BaseStorageOptions, ERRORS, fail, File, FilePart } from '.';
import { BaseStorage, filename } from './storage';
import { ensureFile, fsUnlink, getFileSize, logger } from './utils';

const log = logger.extend('DiskStorage');

export interface MetaStore extends Configstore {
  get: (id: string) => File | undefined;
  set: (id: any, file?: File) => void;
  delete: (id: string) => void;
  clear: () => void;
  all: Record<string, File>;
}
export interface DiskStorageOptions extends BaseStorageOptions {
  directory?: string;
}
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;
const PACKAGE_NAME = 'node-uploadx';

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage {
  /** how often (in ms) to scan for expired uploads */
  static EXPIRY_SCAN_PERIOD = 1 * MILLIS_PER_HOUR;
  /**
   * Where store uploads info
   */
  metaStore: MetaStore;
  directory: string;

  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: DiskStorageOptions) {
    super(config);
    this.directory = config.directory || 'upload';
    this._getFileName = config.filename || filename;
    const configPath = { configPath: normalize(`${this.directory}/${PACKAGE_NAME}.json`) };
    this.metaStore = new Configstore('', {}, configPath);

    if (typeof this.config.expire === 'number') {
      setInterval(
        () => this.expiry(this.config.expire as number),
        DiskStorage.EXPIRY_SCAN_PERIOD
      ).unref();
    }
  }

  /**
   * Remove uploads once they expire
   * @param maxAge The max age in days
   * @param completed If `true` remove completed files too
   */
  expiry(maxAge: number, completed = false): void {
    const expire = Math.floor(maxAge * MILLIS_PER_DAY);
    (async () => {
      const now = new Date().getTime();
      for (const file of Object.values(this.metaStore.all)) {
        const outdated = now - file.timestamp > expire;
        if (outdated) {
          const isExpired =
            completed || file.size !== (await getFileSize(this.fullPath(file.path)));
          if (isExpired) {
            log('[expired]: ', file.path);
            await this._deleteMeta(file.path);
            await fsUnlink(this.fullPath(file.path)).catch(() => {});
          }
        }
      }
    })();
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, file: File): Promise<File> {
    const errors = this.validate(file);
    if (errors.length) return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());
    file.path = this._getFileName(file);
    const path = this.fullPath(file.path);
    file.bytesWritten = await ensureFile(path).catch(ex => fail(ERRORS.FILE_ERROR, ex));
    await this._saveMeta(file.path, file);
    file.status = 'created';
    return file;
  }

  /**
   * Write chunks
   */
  async write(chunk: FilePart): Promise<File> {
    const { start, path, body } = chunk;
    const file = await this._getMeta(path || '');
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    try {
      if (!start || !body) {
        file.bytesWritten = await ensureFile(this.fullPath(file.path));
        if (start !== 0 || file.bytesWritten > 0 || !body) return file;
      }
      file.bytesWritten = await this._write(body, this.fullPath(file.path), start);
      return file;
    } catch (ex) {
      return fail(ERRORS.FILE_ERROR, ex);
    }
  }

  async get(prefix: string): Promise<File[]> {
    const find: File[] = [];
    for (const path in this.metaStore.all) {
      if (path.startsWith(prefix)) {
        const file = this.metaStore.get(path.replace('.', '\\.'));
        file && find.push(file);
      }
    }
    return find;
  }

  async delete(path: string): Promise<File[]> {
    const files = await this.get(path);
    const deleted = [];
    for (const file of files) {
      try {
        await this._deleteMeta(file.path);
        await fsUnlink(this.fullPath(file.path));
        deleted.push(file);
      } catch {}
    }
    return files.length ? deleted : [{ path: path } as File];
  }

  /**
   * Append chunk to file
   */
  protected _write(req: Readable, path: string, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path, { flags: 'r+', start });
      file.once('error', error => reject(error));
      req.once('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
    });
  }

  private _saveMeta(path: string, file: File): Promise<any> {
    this.metaStore.set(path.replace('.', '\\.'), file);
    return Promise.resolve();
  }

  private _deleteMeta(path: string): Promise<any> {
    this.metaStore.delete(path.replace('.', '\\.'));
    return Promise.resolve();
  }

  private _getMeta(path: string): Promise<File> {
    return new Promise((resolve, reject) => {
      const file = this.metaStore.get(path.replace('.', '\\.'));
      if (file) return resolve(file);
      return reject(ERRORS.FILE_NOT_FOUND);
    });
  }

  private fullPath(path: string): string {
    return normalize(join(this.directory, path));
  }
}
