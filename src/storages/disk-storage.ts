import * as http from 'http';
import { extname, join, relative, resolve as pathResolve } from 'path';
import { Readable } from 'stream';
import { ensureFile, ERRORS, fail, fsp, getFiles, getWriteStream } from '../utils';
import { extractOriginalName, File, FileInit, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

export class DiskFile extends File {}

export interface DiskListObject {
  name: string;
  updated: Date;
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
export class DiskStorage extends BaseStorage<DiskFile, DiskListObject> {
  directory: string;

  constructor(public config: DiskStorageOptions) {
    super(config);
    this.directory = config.directory || this.path.replace(/^\//, '');
    this.isReady = true;
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, config: FileInit): Promise<DiskFile> {
    const file = new File(config);
    await this.validate(file);
    file.name = this.namingFunction(file);

    const path = this.fullPath(file.name);
    file.bytesWritten = await ensureFile(path).catch(ex => fail(ERRORS.FILE_ERROR, ex));
    await this._saveMeta(file.name, file);
    file.status = 'created';
    return file;
  }

  /**
   * Write chunks
   */
  async write(chunk: FilePart): Promise<DiskFile> {
    const { start, name, body } = chunk;
    const file = await this._getMeta(name || '');
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    try {
      if (!start || !body) {
        file.bytesWritten = await ensureFile(this.fullPath(file.name));
        if (start !== 0 || file.bytesWritten > 0 || !body) return file;
      }
      file.bytesWritten = await this._write(body, this.fullPath(file.name), start);
      file.status = this.setStatus(file);
      return file;
    } catch (ex) {
      return fail(ERRORS.FILE_ERROR, ex);
    }
  }

  async get(prefix: string): Promise<DiskListObject[]> {
    const files = await getFiles(join(this.directory, prefix));
    const props = async (path: string): Promise<DiskListObject> => ({
      name: relative(this.directory, path).replace(/\\/g, '/'),
      updated: (await fsp.stat(path)).mtime
    });
    return Promise.all(
      files.filter(name => extname(name) !== METAFILE_EXTNAME).map(path => props(path))
    );
  }

  async delete(name: string): Promise<DiskFile[]> {
    const file = await this._getMeta(name);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this._deleteMeta(name), fsp.unlink(this.fullPath(name))]);
      return [file];
    }
    return [{ name } as DiskFile];
  }

  async update(name: string, { metadata }: Partial<File>): Promise<DiskFile> {
    const file = await this._getMeta(name);
    if (!file) return fail(ERRORS.FILE_NOT_FOUND);
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file.name, file);
    return file;
  }

  /**
   * Append chunk to file
   */
  protected _write(req: Readable, path: string, start: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const writeStream = getWriteStream(path, start);
      writeStream.once('error', error => reject(error));
      req.once('aborted', () => {
        writeStream.close();
        return resolve();
      });
      req.pipe(writeStream).on('finish', () => resolve(start + writeStream.bytesWritten));
    });
  }

  private async _saveMeta(name: string, file: File): Promise<any> {
    await fsp.writeFile(this.fullPath(name) + METAFILE_EXTNAME, JSON.stringify(file, null, 2));
    return;
  }

  private async _deleteMeta(name: string): Promise<void> {
    await fsp.unlink(this.fullPath(name) + METAFILE_EXTNAME);
    return;
  }

  private async _getMeta(name: string): Promise<DiskFile | undefined> {
    try {
      const data = await fsp.readFile(this.fullPath(name) + METAFILE_EXTNAME);
      return JSON.parse(data.toString());
    } catch {}
    return;
  }

  private fullPath(name: string): string {
    return pathResolve(this.directory, name);
  }
}
