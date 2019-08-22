import * as Configstore from 'configstore';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { ERRORS, fail, File, BaseStorage, Range } from './core';
import { ensureFile, fsUnlink, hashObject } from './utils';
export type Destination = string | (<T extends http.IncomingMessage>(req: T, file: File) => string);
interface MetaStore extends Configstore {
  get: (id: string) => File | undefined;
  set: (id: any, file?: File) => void;
  delete: (id: string) => void;
  clear: () => void;
  all: Record<string, File>;
}
export type DiskStorageOptions =
  | {
      destination: Destination;
    }
  | {
      dest: Destination;
    };

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8'));

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
  constructor(opts: DiskStorageOptions) {
    super();
    this.destination = 'dest' in opts ? opts.dest : opts.destination;
    if (!this.destination) throw new TypeError('Destination option required');
    this.metaStore = new Configstore(this.metaVersion);
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, file: File): Promise<File> {
    file.id = file.id || hashObject(file);
    file.path = this.setFilePath(req, file);
    file.bytesWritten = await ensureFile(file.path).catch(error => fail(ERRORS.FILE_ERROR, error));
    this.metaStore.set(file.id, file);
    return file;
  }

  /**
   * Write chunks
   */
  async update(req: http.IncomingMessage, { start, total, id, userId }: Range): Promise<File> {
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
    } catch (error) {
      return fail(ERRORS.FILE_ERROR, error);
    }
  }
  async get({ id, userId }: Partial<File>): Promise<File[]> {
    if (id) {
      const file = this.metaStore.get(id);
      if (!file) return fail(ERRORS.FILE_NOT_FOUND);
      const isForbidden = userId !== (file.userId || userId);
      if (this.accessCheck && isForbidden) return fail(ERRORS.FORBIDDEN);
      return [file];
    } else {
      return Object.values(this.metaStore.all).filter(file => userId === (file.userId || userId));
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

  protected setFilePath(req: http.IncomingMessage, file: File): string {
    if (this.destination instanceof Function) {
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
