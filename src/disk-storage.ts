import * as Configstore from 'configstore';
import * as fs from 'fs';
import * as http from 'http';
import { join, resolve } from 'path';
import { BaseStorage, Destination, DiskStorageConfig, ERRORS, File, UploadXError } from './core';
import { ensureFile, fsUnlink, hashObject } from './utils';

const pkg = JSON.parse(fs.readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage {
  reset() {
    const files = this.metaStore.all;
    for (const id in files) {
      try {
        fs.unlinkSync(files[id].path);
      } catch {}
    }
    this.metaStore.clear();
  }
  /**
   * Meta Format version
   * @beta
   */
  private readonly metaVersion = `${pkg.name}@${pkg.version}`;
  /**
   * Where store uploads info
   */
  public metaStore: Configstore;
  /**
   * Where store files
   */
  private dest: Destination;

  constructor(private options: DiskStorageConfig) {
    super();
    this.dest = this.options.destination! || this.options.dest!;
    if (!this.dest) throw new Error('Destination option required');
    this.metaStore = new Configstore(this.metaVersion);
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, file: File): Promise<File> {
    file.id = hashObject(file);
    file.path = this.setFilePath(req, file);
    try {
      file.bytesWritten = await ensureFile(file.path);
    } catch (error) {
      throw new UploadXError(ERRORS.FILE_ERROR, error);
    }
    this.metaStore.set(file.id, file);
    return file;
  }

  protected setFilePath(req: http.IncomingMessage, file: File): string {
    if (this.dest instanceof Function) {
      const path = this.dest(req as any, file);
      return path.endsWith('/') ? join(path, file.id) : path;
    } else {
      return join(this.dest, file.id);
    }
  }

  /**
   * Write chunks
   */
  async write(req: http.IncomingMessage, { start, total, id }): Promise<File> {
    const file: File = this.metaStore.get(id);
    if (!file || !file.path) throw new UploadXError(ERRORS.FILE_NOT_FOUND);
    if (total >= 0 && total !== file.size) throw new UploadXError(ERRORS.INVALID_RANGE);
    if (!start) {
      try {
        file.bytesWritten = await ensureFile(file.path);
        if (start !== 0 || file.bytesWritten > 0) {
          return file;
        }
      } catch (error) {
        throw new UploadXError(ERRORS.FILE_ERROR, error);
      }
    }
    file.bytesWritten = await this._write(req, file.path, start);
    return file;
  }

  /**
   * Append chunk to file
   *
   */
  protected _write(req: http.IncomingMessage, path: string, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(path, {
        flags: 'r+',
        start
      });
      file.on('error', error => reject(new UploadXError(ERRORS.FILE_ERROR, error)));
      req.on('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
    });
  }

  async delete(id: string): Promise<File> {
    const file = this.metaStore.get(id) as File;
    file && file.path && (await fsUnlink(file.path));
    this.metaStore.delete(id);
    file.status = 'deleted';
    return file;
  }
}
