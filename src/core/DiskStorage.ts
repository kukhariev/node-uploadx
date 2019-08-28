import * as Configstore from 'configstore';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { BaseStorage, ERRORS, fail, File, FilePart, StorageOptions } from '.';
import { cp, ensureFile, fsUnlink } from './utils';

const pkg = { name: 'node-uploadx', version: '2.0' };

export type Destination = string | (<T extends http.IncomingMessage>(req: T, file: File) => string);

export interface MetaStore extends Configstore {
  get: (id: string) => File | undefined;
  set: (id: any, file?: File) => void;
  delete: (id: string) => void;
  clear: () => void;
  all: Record<string, File>;
}
export interface DiskStorageOptions extends StorageOptions {
  dest?: Destination;
  destination?: Destination;
}

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage {
  /**
   * Where store uploads info
   */
  metaStore: MetaStore;
  accessCheck = true;

  /**
   * Where store files
   */
  private destination: Destination;

  /**
   * Meta Format version
   * @beta
   */
  private readonly metaVersion = `${pkg.name}@${pkg.version}`;

  constructor(public config: DiskStorageOptions) {
    super(config);
    this.destination = config.dest || config.destination || './upload';
    if (typeof this.destination !== 'string' && typeof this.destination !== 'function')
      throw new TypeError('Invalid Destination Parameter');
    this.metaStore = new Configstore(this.metaVersion);
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, file: File): Promise<File> {
    try {
      file.path = this.setFilePath(req, file);
    } catch (error) {
      return fail(ERRORS.FILE_NOT_ALLOWED);
    }
    const errors = this.validate(file);
    if (errors.length) {
      return fail(ERRORS.FILE_NOT_ALLOWED, errors.toString());
    }
    await ensureFile(file.path).catch(ex => fail(ERRORS.FILE_ERROR, ex));
    this.metaStore.set(file.id, file);
    return file;
  }

  /**
   * Write chunks
   */
  async write(req: http.IncomingMessage, filePart: FilePart): Promise<File> {
    const { start, total, id, userId } = filePart;
    const [file] = await this.get({ id, userId });
    if (total && total !== file.size) return fail(ERRORS.INVALID_RANGE);
    try {
      if (!start) {
        file.bytesWritten = await ensureFile(file.path);
        if (start !== 0 || file.bytesWritten > 0) {
          return file;
        }
      }
      file.bytesWritten = await this._write(req, file.path, start);
      return file;
    } catch (ex) {
      return fail(ERRORS.FILE_ERROR, ex);
    }
  }
  async get(query: Partial<File>): Promise<File[]> {
    if (query.id) {
      const file = this.metaStore.get(query.id);
      if (file && cp(file, query)) return [file];
      if (query.userId) return fail(ERRORS.FORBIDDEN);
      return fail(ERRORS.FILE_NOT_FOUND);
    } else {
      return Object.values(this.metaStore.all).filter(file => cp(file, query));
    }
  }

  async delete(query: Partial<File>): Promise<File[]> {
    const files = await this.get(query);
    const deleted = [];
    for (const file of files) {
      try {
        await fsUnlink(file.path);
        this.metaStore.delete(file.id);
        deleted.push(file);
      } catch {}
    }
    return deleted;
  }

  // TODO: move to constructor
  protected setFilePath(req: http.IncomingMessage, file: File): string {
    if (typeof this.destination === 'function') {
      const filePath = this.destination(req, file);
      return filePath.endsWith('/') ? path.join(filePath, file.id) : filePath;
    } else {
      return path.join(this.destination, file.id);
    }
  }
  /**
   * Append chunk to file
   *
   */
  protected _write(req: http.IncomingMessage, filePath: string, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(filePath, {
        flags: 'r+',
        start
      });
      file.once('error', error => reject(error));
      req.once('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
    });
  }
}
