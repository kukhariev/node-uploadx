import { createWriteStream } from 'fs';
import * as http from 'http';
import { extname, join, resolve as pathResolve } from 'path';
import { Readable } from 'stream';
import { ensureFile, ERRORS, fail, fsp, getFiles } from '../utils';
import { File, FileInit, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, DEFAULT_FILENAME, METAFILE_EXTNAME } from './storage';

export class DiskFile extends File {
  timestamp?: number;
}
export interface DiskStorageOptions extends BaseStorageOptions {
  /**
   * Uploads directory
   * @defaultValue './files'
   */
  directory?: string;
}

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage {
  directory: string;

  private _getFileName: (file: Partial<File>) => string;

  constructor(public config: DiskStorageOptions) {
    super(config);
    this.directory = config.directory || this.path.replace(/^\//, '');
    this._getFileName = config.filename || DEFAULT_FILENAME;
    this.isReady = true;
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
    const find: File[] = [];
    const list = (await getFiles(join(this.directory, prefix))).filter(
      filename => extname(filename) !== METAFILE_EXTNAME
    );
    for (const path of list) {
      const file = await this._getMeta(path);
      file && find.push(file);
    }
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

  async update(path: string, { metadata }: Partial<File>): Promise<File> {
    const file = await this._getMeta(path);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    Object.assign(file.metadata, metadata);
    await this._saveMeta(file.path, file);
    return file;
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

  private async _saveMeta(path: string, file: DiskFile): Promise<any> {
    await fsp.writeFile(this.fullPath(path) + METAFILE_EXTNAME, JSON.stringify(file, null, 2));
    return;
  }

  private async _deleteMeta(path: string): Promise<any> {
    await fsp.unlink(this.fullPath(path) + METAFILE_EXTNAME);
    return;
  }

  private async _getMeta(path: string): Promise<File | undefined> {
    try {
      const data = await fsp.readFile(this.fullPath(path) + METAFILE_EXTNAME);
      return JSON.parse(data.toString());
    } catch {}
    return;
  }

  private fullPath(path: string): string {
    return pathResolve(this.directory, path);
  }
}
