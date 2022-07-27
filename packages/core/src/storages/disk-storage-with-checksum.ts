import { FilePart, FileQuery, getFileStatus, hasContent, partMatch, updateSize } from './file';
import {
  ensureFile,
  ERRORS,
  fail,
  getWriteStream,
  hashes,
  removeFile,
  streamChecksum,
  streamLength,
  truncateFile
} from '../utils';
import { DiskFile, DiskStorage, DiskStorageOptions } from './disk-storage';

/**
 *  Additionally calculates checksum of the file/range
 */
export class DiskStorageWithChecksum extends DiskStorage {
  constructor(config: DiskStorageOptions) {
    super(config);
    hashes.algorithm = config.checksum === 'sha1' ? 'sha1' : 'md5';
  }

  async delete({ id }: FileQuery): Promise<DiskFile[]> {
    try {
      const file = await this.getMeta(id);
      const path = this.getFilePath(file.name);
      hashes.delete(path);
      await removeFile(path);
      await this.deleteMeta(id);
      return [{ ...file, status: 'deleted' }];
    } catch {}
    return [{ id } as DiskFile];
  }

  async write(part: FilePart | FileQuery): Promise<DiskFile> {
    const file = await this.getMeta(part.id);
    await this.checkIfExpired(file);
    if (file.status === 'completed') return file;
    if (part.size) updateSize(file, part.size);
    if (!partMatch(part, file)) return fail(ERRORS.FILE_CONFLICT);
    const path = this.getFilePath(file.name);
    try {
      file.bytesWritten = (part as FilePart).start || (await ensureFile(path));
      await hashes.init(path);
      if (hasContent(part)) {
        if (this.isUnsupportedChecksum(part.checksumAlgorithm)) {
          return fail(ERRORS.UNSUPPORTED_CHECKSUM_ALGORITHM);
        }
        const [bytesWritten, errorCode] = await this._write({ ...part, ...file });
        if (errorCode) {
          await truncateFile(path, file.bytesWritten);
          return fail(errorCode);
        }
        if (!bytesWritten) {
          await hashes.updateFromFs(path, file.bytesWritten);
        }
        file.bytesWritten = bytesWritten;
      }
      file.status = getFileStatus(file);
      file[hashes.algorithm] = hashes.hex(path);
      file.status === 'completed' && hashes.delete(path);
      await this.saveMeta(file);
      return file;
    } catch (err) {
      await hashes.updateFromFs(path, file.bytesWritten);
      return fail(ERRORS.FILE_ERROR, err);
    }
  }

  protected _write(part: FilePart & DiskFile): Promise<[number, ERRORS?]> {
    return new Promise((resolve, reject) => {
      const path = this.getFilePath(part.name);
      const dest = getWriteStream(path, part.start);
      const lengthChecker = streamLength(part.contentLength || part.size - part.start);
      const checksumChecker = streamChecksum(part.checksum, part.checksumAlgorithm);
      const digester = hashes.digester(path);
      const keepPartial = !part.checksum;
      const failWithCode = (code?: ERRORS): void => {
        digester.reset();
        dest.close();
        resolve([NaN, code]);
      };
      lengthChecker.on('error', () => failWithCode(ERRORS.FILE_CONFLICT));
      checksumChecker.on('error', () => failWithCode(ERRORS.CHECKSUM_MISMATCH));
      part.body.on('aborted', () => failWithCode(keepPartial ? undefined : ERRORS.REQUEST_ABORTED));
      part.body
        .pipe(lengthChecker)
        .pipe(checksumChecker)
        .pipe(digester)
        .pipe(dest)
        .on('error', (err: Error) => {
          digester.reset();
          reject(err);
        })
        .on('finish', () => resolve([part.start + dest.bytesWritten]));
    });
  }
}
