import * as http from 'http';
import { resolve as pathResolve } from 'path';
import {
  ensureFile,
  ERRORS,
  fail,
  fileChecksum,
  fsp,
  getWriteStream,
  HttpError,
  move
} from '../utils';
import { File, FileInit, FilePart, hasContent, isCompleted, isValidPart } from './file';
import { BaseStorage, BaseStorageOptions } from './storage';
import { METAFILE_EXTNAME, MetaStorage } from './meta-storage';
import { LocalMetaStorage, LocalMetaStorageOptions } from './local-meta-storage';

const INVALID_OFFSET = -1;

export interface DiskFile extends File {
  move: (dest: string) => Promise<any>;
  copy: (dest: string) => Promise<any>;
  delete: () => Promise<any>;
  hash: (algorithm?: 'sha1' | 'md5', encoding?: 'hex' | 'base64') => Promise<string>;
}

export type DiskStorageOptions = BaseStorageOptions<DiskFile> & {
  /**
   * Uploads directory
   * @defaultValue './files'
   */
  directory?: string;
  /**
   * Configuring metafile storage on the local disk
   * @example
   * const storage = new DiskStorage({
   *   directory: 'upload',
   *   metaStorageConfig: { directory: '/tmp/upload-metafiles', prefix: '.' }
   * })
   */
  metaStorageConfig?: LocalMetaStorageOptions;
};

/**
 * Local Disk Storage
 */
export class DiskStorage extends BaseStorage<DiskFile> {
  directory: string;
  meta: MetaStorage<DiskFile>;

  constructor(public config: DiskStorageOptions = {}) {
    super(config);
    this.directory = config.directory || this.path.replace(/^\//, '');
    if (config.metaStorage) {
      this.meta = config.metaStorage;
    } else {
      const metaConfig = { ...config, ...(config.metaStorageConfig || {}) };
      this.meta = new LocalMetaStorage(metaConfig);
    }
    this.isReady = true;
    this.maxFilenameLength = 255 - pathResolve(this.directory, METAFILE_EXTNAME).length;
  }

  normalizeError(error: Error): HttpError {
    return super.normalizeError(error);
  }

  buildCompletedFile(file: DiskFile): DiskFile {
    const completed = { ...file };
    completed.lock = async lockFn => {
      completed.lockedBy = lockFn;
      return Promise.resolve(completed.lockedBy);
    };
    completed.delete = () => this.delete(file.name);
    completed.hash = (algorithm?: 'sha1' | 'md5', encoding?: 'hex' | 'base64') =>
      fileChecksum(this.getFilePath(file.name), algorithm, encoding);
    completed.copy = async (dest: string) => fsp.copyFile(this.getFilePath(file.name), dest);
    completed.move = async (dest: string) => move(this.getFilePath(file.name), dest);

    return completed;
  }

  async create(req: http.IncomingMessage, fileInit: FileInit): Promise<DiskFile> {
    const file = new File(fileInit) as DiskFile;
    file.name = this.namingFunction(file);
    await this.validate(file);
    const path = this.getFilePath(file.name);
    file.bytesWritten = await ensureFile(path).catch(e => fail(ERRORS.FILE_ERROR, e));
    await this.saveMeta(file);
    file.status = 'created';
    return file;
  }

  async write(part: FilePart): Promise<DiskFile> {
    const file = await this.getMeta(part.name);
    if (file.status === 'completed') return file;
    if (file.lockedBy) return file;
    await this.checkIfExpired(file);
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);
    try {
      file.bytesWritten = await this._write({ ...file, ...part });
      if (file.bytesWritten === INVALID_OFFSET) return fail(ERRORS.FILE_CONFLICT);
      if (isCompleted(file)) {
        await this.saveMeta(file);
        return this.buildCompletedFile(file);
      }
      return file;
    } catch (err) {
      return fail(ERRORS.FILE_ERROR, err);
    }
  }

  /**
   * @inheritdoc
   * @todo delete by prefix
   */
  async delete(name: string): Promise<DiskFile[]> {
    const file = await this.getMeta(name).catch(() => null);
    if (file) {
      await fsp.unlink(this.getFilePath(name)).catch(() => null);
      await this.deleteMeta(name);
      return [{ ...file, status: 'deleted' }];
    }
    return [{ name } as DiskFile];
  }

  /**
   * Returns an absolute path of the uploaded file
   */
  getFilePath(name: string): string {
    return pathResolve(this.directory, name);
  }

  protected _write(part: FilePart & File): Promise<number> {
    return new Promise((resolve, reject) => {
      const path = this.getFilePath(part.name);
      if (hasContent(part)) {
        const file = getWriteStream(path, part.start);
        file.once('error', error => reject(error));
        const body = part.body;
        body.once('aborted', () => {
          file.close();
          return resolve(NaN);
        });
        let start = part.start;
        body.on('data', (chunk: { length: number }) => {
          start += chunk.length;
          if (start > part.size) {
            file.close();
            return resolve(INVALID_OFFSET);
          }
        });
        body.pipe(file).on('finish', () => resolve(part.start + file.bytesWritten));
      } else {
        resolve(ensureFile(path));
      }
    });
  }
}
