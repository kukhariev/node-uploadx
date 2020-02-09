import * as http from 'http';
import { extname, join, relative, resolve as pathResolve } from 'path';
import { ensureFile, ERRORS, fail, fsp, getFiles, getWriteStream } from '../utils';
import { extractOriginalName, File, FileInit, FilePart, hasContent } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

export class DiskFile extends File {}

export interface DiskListObject {
  name: string;
  updated: Date;
}
export type DiskStorageOptions = BaseStorageOptions<DiskFile> & {
  /**
   * Uploads directory
   * @defaultValue './files'
   */
  directory?: string;
};

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage<DiskFile, DiskListObject> {
  directory: string;

  constructor(public config: DiskStorageOptions = {}) {
    super(config);
    this.directory = config.directory || this.path.replace(/^\//, '');
    this.isReady = true;
  }

  /**
   * Add file to storage
   */
  async create(req: http.IncomingMessage, fileInit: FileInit): Promise<DiskFile> {
    const file = new DiskFile(fileInit);
    file.name = this.namingFunction(file);
    await this.validate(file);
    file.bytesWritten = await this._saveMeta(file);
    file.status = 'created';
    return file;
  }

  /**
   * Write chunks
   */
  async write(part: FilePart): Promise<DiskFile> {
    const file = await this._getMeta(part.name);
    try {
      file.bytesWritten = await this._write({ ...file, ...part });
      file.status = this.setStatus(file);
      if (file.status === 'completed') {
        await Promise.all([this.onComplete(file)]);
      }
      return file;
    } catch (e) {
      return fail(ERRORS.FILE_ERROR, e);
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
    const file = await this._getMeta(name).catch(() => null);
    if (file) {
      file.status = 'deleted';
      await Promise.all([this._deleteMeta(name), fsp.unlink(this._getPath(name))]);
      return [{ ...file }];
    }
    return [{ name } as DiskFile];
  }

  async update(name: string, { metadata }: Partial<File>): Promise<DiskFile> {
    const file = await this._getMeta(name);
    file.metadata = { ...file.metadata, ...metadata };
    file.originalName = extractOriginalName(file.metadata) || file.originalName;
    await this._saveMeta(file);
    return file;
  }

  private _write(part: FilePart): Promise<number> {
    return new Promise((resolve, reject) => {
      const path = this._getPath(part.name);
      if (hasContent(part)) {
        const file = getWriteStream(path, part.start);
        file.once('error', error => reject(error));
        part.body.once('aborted', () => {
          file.close();
          return resolve(NaN);
        });
        part.body.pipe(file).on('finish', () => resolve(part.start + file.bytesWritten));
      } else {
        resolve(ensureFile(path));
      }
    });
  }

  private async _saveMeta(file: DiskFile): Promise<number> {
    const path = this._getPath(file.name);
    const bytesWritten = await ensureFile(path).catch(e => fail(ERRORS.FILE_ERROR, e));
    await fsp.writeFile(this._getMetaPath(file.name), JSON.stringify(file, null, 2));
    this.cache.set(file.name, file);
    return bytesWritten;
  }

  private async _deleteMeta(name: string): Promise<void> {
    this.cache.delete(name);
    await fsp.unlink(this._getMetaPath(name));
    return;
  }

  private async _getMeta(name: string): Promise<DiskFile> {
    const file = this.cache.get(name);
    if (file?.size) return file;
    try {
      const json = await fsp.readFile(this._getMetaPath(name));
      const data = JSON.parse(json.toString());
      this.cache.set(name, data);
      return data;
    } catch {}
    return fail(ERRORS.FILE_NOT_FOUND);
  }

  private _getPath(name: string): string {
    return pathResolve(this.directory, name);
  }

  private _getMetaPath(name: string): string {
    return this._getPath(name) + METAFILE_EXTNAME;
  }
}
