import * as Configstore from 'configstore';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';
import { ERRORS, fail, File, BaseStorage, Range } from './core';
import { ensureFile, fsUnlink, hashObject } from './utils';
export type Destination = string | (<T extends http.IncomingMessage>(req: T, file: File) => string);

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
  metaStore: Configstore;
  /**
   * Where store files
   */
  private dest: Destination;

  /**
   * Meta Format version
   * @beta
   */
  private readonly metaVersion = `${pkg.name}@${pkg.version}`;
  constructor(opts: DiskStorageOptions) {
    super();
    this.dest = 'dest' in opts ? opts.dest : opts.destination;
    if (!this.dest) throw new TypeError('Destination option required');
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
  async update(req: http.IncomingMessage, { start, total, id }: Range): Promise<File> {
    const file: File = this.metaStore.get(id);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
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

  async delete(id: string, userId: string): Promise<File> {
    const file = this.metaStore.get(id) as File;
    if (!file || file.userId !== userId || !file.path) return fail(ERRORS.FILE_NOT_FOUND);
    try {
      await fsUnlink(file.path);
      this.metaStore.delete(id);
    } catch {}
    return file;
  }

  read(id?: string): Promise<File | File[]> {
    const files = id
      ? (this.metaStore.get(id) as File)
      : (Object.values(this.metaStore.all) as File[]);
    return Promise.resolve(files);
  }
  reset(): void {
    const files = this.metaStore.all;
    for (const id in files) {
      try {
        fs.unlinkSync(files[id].path);
      } catch {}
    }
    this.metaStore.clear();
  }

  protected setFilePath(req: http.IncomingMessage, file: File): string {
    if (this.dest instanceof Function) {
      const filePath = this.dest(req, file);
      return filePath.endsWith('/') ? path.join(filePath, file.id) : filePath;
    } else {
      return path.join(this.dest, file.id);
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
      file.once('error', error => {
        reject(error);
      });
      req.once('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
    });
  }
}
