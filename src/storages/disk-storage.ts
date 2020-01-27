import { createWriteStream } from 'fs';
import * as http from 'http';
import { join, resolve as pathResolve } from 'path';
import { Readable } from 'stream';
import { ensureFile, ERRORS, fail, fsp, getFiles } from '../utils';
import { extractOriginalName, File, FileInit, FilePart } from './file';
import { BaseStorage, BaseStorageOptions, METAFILE_EXTNAME } from './storage';

export class DiskFile extends File {
  timestamp?: number;
}
export interface DiskListObject {
  name: string;
  uri?: string;
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
      return file;
    } catch (ex) {
      return fail(ERRORS.FILE_ERROR, ex);
    }
  }

  // async get(prefix: string): Promise<DiskFile[]> {
  //   const files: File[] = [];
  //   for (const path of await getFiles(join(this.directory, prefix))) {
  //     try {
  //       const data =
  //         extname(path) !== METAFILE_EXTNAME ? await fsp.readFile(path + METAFILE_EXTNAME) : null;
  //       data && files.push(JSON.parse(data.toString()));
  //     } catch (error) {
  //       this.log('[error]: %o', error);
  //     }
  //   }
  //   return files as  DiskFile[];
  // }

  async get(prefix: string): Promise<DiskListObject[]> {
    const files = await getFiles(join(this.directory, prefix));
    return files.map(name => ({ name })) as DiskListObject[];
  }

  async delete(name: string): Promise<DiskFile[]> {
    const file = await this._getMeta(name);
    await this._deleteMeta(name);
    await fsp.unlink(this.fullPath(name));

    return [file as File];
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
      const file = createWriteStream(path, { flags: 'r+', start });
      file.once('error', error => reject(error));
      req.once('aborted', () => file.close());
      req.pipe(file).on('finish', () => resolve(start + file.bytesWritten));
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
