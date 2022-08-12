import * as http from 'http';
import { join } from 'path';
import {
  accessCheck,
  ensureFile,
  ERRORS,
  fail,
  getWriteStream,
  HttpError,
  removeFile,
  streamChecksum,
  streamLength,
  truncateFile
} from '../utils';
import {
  File,
  FileInit,
  FilePart,
  FileQuery,
  getFileStatus,
  hasContent,
  partMatch,
  updateSize
} from './file';
import { BaseStorage, BaseStorageOptions } from './storage';
import { MetaStorage } from './meta-storage';
import { LocalMetaStorage, LocalMetaStorageOptions } from './local-meta-storage';

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
  checksumTypes = ['md5', 'sha1', 'sha256'];
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
      this.logger.error('[error]: Could not write to directory: %o', err);
    });
  }

  normalizeError(err: Error): HttpError {
    return super.normalizeError(err);
  }

  async create(req: http.IncomingMessage, fileInit: FileInit): Promise<DiskFile> {
    const file = new DiskFile(fileInit);
    file.name = this.namingFunction(file, req);
    file.size = Number.isNaN(file.size) ? this.maxUploadSize : file.size;
    await this.validate(file);
    const path = this.getFilePath(file.name);
    file.bytesWritten = await ensureFile(path).catch(err => fail(ERRORS.FILE_ERROR, err));
    file.status = getFileStatus(file);
    await this.saveMeta(file);
    return file;
  }

  async write(part: FilePart | FileQuery): Promise<DiskFile> {
    const file = await this.getMeta(part.id);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (part.size) updateSize(file, part.size);
    if (!partMatch(part, file)) return fail(ERRORS.FILE_CONFLICT);
    const path = this.getFilePath(file.name);
    await this.lock(path);
    try {
      if (hasContent(part)) {
        if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
          return fail(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
        }
        const [bytesWritten, errorCode] = await this._write({ ...file, ...part });
        if (errorCode) {
          await truncateFile(path, part.start);
          return fail(errorCode);
        }
        file.bytesWritten = bytesWritten;
        file.status = getFileStatus(file);
        await this.saveMeta(file);
      } else {
        file.bytesWritten = await ensureFile(path);
      }
      return file;
    } catch (err) {
      return fail(ERRORS.FILE_ERROR, err);
    } finally {
      await this.unlock(path);
    }
  }

  async delete({ id }: FileQuery): Promise<DiskFile[]> {
    try {
      const file = await this.getMeta(id);
      await removeFile(this.getFilePath(file.name));
      await this.deleteMeta(id);
      return [{ ...file, status: 'deleted' }];
    } catch {}
    return [{ id } as DiskFile];
  }

  /**
   * Returns path for the uploaded file
   */
  getFilePath(filename: string): string {
    return join(this.directory, filename);
  }

  protected _write(part: FilePart & File): Promise<[number, ERRORS?]> {
    return new Promise((resolve, reject) => {
      const dest = getWriteStream(this.getFilePath(part.name), part.start);
      const lengthChecker = streamLength(part.contentLength || part.size - part.start);
      const checksumChecker = streamChecksum(part.checksum, part.checksumAlgorithm);
      const keepPartial = !part.checksum;
      const failWithCode = (code?: ERRORS): void => {
        dest.close();
        resolve([NaN, code]);
      };
      lengthChecker.on('error', () => failWithCode(ERRORS.FILE_CONFLICT));
      checksumChecker.on('error', () => failWithCode(ERRORS.CHECKSUM_MISMATCH));
      part.body.on('aborted', () => failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED));
      part.body
        .pipe(lengthChecker)
        .pipe(checksumChecker)
        .pipe(dest)
        .on('error', reject)
        .on('finish', () => {
          return resolve([part.start + dest.bytesWritten]);
        });
    });
  }

  private accessCheck(): Promise<void> {
    return accessCheck(this.directory);
  }
}
