import * as Configstore from 'configstore';
import { createWriteStream } from 'fs';
import * as http from 'http';
import { join } from 'path';
import { Readable } from 'stream';
import { ensureFile, ERRORS, fail, fsp, getFileSize, noop } from '../utils';
import { File, FilePart, FileInit } from './file';
import { BaseStorage, BaseStorageOptions, DEFAULT_FILENAME } from './storage';

export class DiskFile extends File {
  timestamp?: number;
}
export interface MetaStore extends Configstore {
  get: (id: string) => DiskFile | undefined;
  set: (id: any, file?: DiskFile) => void;
  delete: (id: string) => void;
  clear: () => void;
  all: Record<string, DiskFile>;
}
export interface DiskStorageOptions extends BaseStorageOptions {
  /**
   * Uploads directory
   * @defaultValue './upload'
   */
  directory?: string;
}
const MILLIS_PER_HOUR = 60 * 60 * 1000;
const MILLIS_PER_DAY = 24 * MILLIS_PER_HOUR;
const METADATAS_FILE = 'UPLOADS_METADATA';

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
    this.directory = config.directory || this.path.replace(/^\//, '');
    this._getFileName = config.filename || DEFAULT_FILENAME;
    const configPath = { configPath: join(this.directory, METADATAS_FILE) };
    this.metaStore = new Configstore('', {}, configPath);

    if (typeof this.config.expire === 'number') {
      setInterval(
        () => this.expiry(this.config.expire as number),
        DiskStorage.EXPIRY_SCAN_PERIOD
      ).unref();
    }
    this.isReady = true;
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
        const outdated = now - (file.timestamp || 0) > expire;
        if (outdated) {
          const isExpired =
            completed || file.size !== (await getFileSize(this.fullPath(file.path)));
          if (isExpired) {
            this.log('[expired]: ', file.path);
            await this._deleteMeta(file.path);
            await fsp.unlink(this.fullPath(file.path)).catch(noop);
          }
        }
      }
    })();
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, config: FileInit): Promise<File> {
    const file = new DiskFile(config);
    await this.validate(file);
    file.path = this._getFileName(file);
    file.timestamp = new Date().getTime();
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
    const find: File[] = Object.entries(this.metaStore.all)
      .filter(([key]) => key.startsWith(prefix))
      .map(([, val]) => val);
    return find;
  }

  async delete(path: string): Promise<File[]> {
    const files = await this.get(path);
    const deleted = [];
    for (const file of files) {
      try {
        await this._deleteMeta(file.path);
        await fsp.unlink(this.fullPath(file.path));
        deleted.push(file);
      } catch {}
    }
    return files.length ? deleted : [{ path } as File];
  }

  /**
   * Append chunk to file
   */
  protected _write(req: Readable, path: string, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(path, { flags: 'r+', start });
      file.once('error', error => reject(error));
      req.once('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
    });
  }

  private _saveMeta(path: string, file: DiskFile): Promise<any> {
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
    return join(this.directory, path);
  }
}
