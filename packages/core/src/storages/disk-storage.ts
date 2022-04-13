import * as http from 'http';
import { resolve as pathResolve } from 'path';
import {
  accessCheck,
  ensureFile,
  ERRORS,
  fail,
  getWriteStream,
  HttpError,
  removeFile,
  truncateFile
} from '../utils';
import { File, FileInit, FilePart, getFileStatus, hasContent, isValidPart } from './file';
import { BaseStorage, BaseStorageOptions } from './storage';
import { MetaStorage } from './meta-storage';
import { LocalMetaStorage, LocalMetaStorageOptions } from './local-meta-storage';
import { createHash } from 'crypto';

const INVALID_OFFSET = -1;
const CHECKSUM_MISMATCH = -2;

export class DiskFile extends File {}

export type DiskStorageOptions = BaseStorageOptions<DiskFile> & {
  /**
   * Uploads directory
   * @defaultValue './files'
   */
  directory?: string;
  /**
   * Configuring metafile storage on the local disk
   * @example
   * ```ts
   * const storage = new DiskStorage({
   *   directory: 'upload',
   *   metaStorageConfig: { directory: '/tmp/upload-metafiles', prefix: '.' }
   * });
   * ```
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
    this.accessCheck().catch(err => {
      this.isReady = false;
      // eslint-disable-next-line no-console
      console.error('ERROR: Could not write to directory: %o', err);
    });
  }

  normalizeError(error: Error): HttpError {
    return super.normalizeError(error);
  }

  async create(req: http.IncomingMessage, fileInit: FileInit): Promise<DiskFile> {
    const file = new DiskFile(fileInit);
    file.name = this.namingFunction(file, req);
    file.size = Number.isNaN(file.size) ? this.maxUploadSize : file.size;
    await this.validate(file);
    const path = this.getFilePath(file);
    file.bytesWritten = await ensureFile(path).catch(e => fail(ERRORS.FILE_ERROR, e));
    file.status = getFileStatus(file);
    await this.saveMeta(file);
    return file;
  }

  async write(part: FilePart): Promise<DiskFile> {
    const file = await this.getMeta(part.id);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (part.size && part.size < file.size) {
      file.size = part.size;
    }
    if (!isValidPart(part, file)) return fail(ERRORS.FILE_CONFLICT);
    if (part.checksum && !this.checksumTypes.includes(part.checksumAlgorithm || '')) {
      return fail(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
    }
    try {
      file.bytesWritten = await this._write({ ...file, ...part });
      if (file.bytesWritten === INVALID_OFFSET) return fail(ERRORS.FILE_CONFLICT);
      if (file.bytesWritten === CHECKSUM_MISMATCH) return fail(ERRORS.CHECKSUM_MISMATCH);
      file.status = getFileStatus(file);
      await this.saveMeta(file);
      return file;
    } catch (err) {
      return fail(ERRORS.FILE_ERROR, err);
    }
  }

  async delete({ id }: FilePart): Promise<DiskFile[]> {
    try {
      const file = await this.getMeta(id);
      await removeFile(this.getFilePath(file));
      await this.deleteMeta(id);
      return [{ ...file, status: 'deleted' }];
    } catch {}
    return [{ id } as DiskFile];
  }

  /**
   * Returns an absolute path of the uploaded file
   */
  getFilePath(file: DiskFile): string {
    return pathResolve(this.directory, file.name);
  }

  protected _write(part: FilePart & File): Promise<number> {
    return new Promise((resolve, reject) => {
      const path = this.getFilePath(part);
      if (hasContent(part)) {
        const file = getWriteStream(path, part.start);
        const hash = createHash(part.checksumAlgorithm || 'sha1');
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
            void truncateFile(path, part.start);
            return resolve(INVALID_OFFSET);
          }
          if (part.checksum) hash.update(chunk as string);
        });
        body.pipe(file).on('finish', () => {
          const digest = hash.digest('base64');
          if (part.checksum && digest !== part.checksum) {
            file.close();
            void truncateFile(path, part.start);
            return resolve(CHECKSUM_MISMATCH);
          }

          resolve(part.start + file.bytesWritten);
        });
      } else {
        resolve(ensureFile(path));
      }
    });
  }

  private accessCheck(): Promise<void> {
    return accessCheck(this.directory);
  }
}
