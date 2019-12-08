import * as http from 'http';
import * as multiparty from 'multiparty';
import { BaseStorage, File, FileInit } from '../storages';
import { DiskStorage, DiskStorageOptions } from '../storages/disk-storage';
import { ERRORS, fail } from '../utils';
import { BaseHandler } from './base-handler';

export class Multipart<T extends BaseStorage> extends BaseHandler {
  storage: T | DiskStorage;
  constructor(config: { storage: T } | DiskStorageOptions) {
    super();
    this.storage = 'storage' in config ? config.storage : new DiskStorage(config);
    this.log('options: %o', config);
  }

  post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();
      const config: FileInit = { metadata: {} };
      form.on('field', (key, value) => {
        Object.assign(config.metadata, key === 'metadata' ? JSON.parse(value) : { [key]: value });
      });
      form.on('part', (part: multiparty.Part) => {
        config.size = part.byteCount;
        config.filename = part.filename;
        config.contentType = part.headers['content-type'];
        config.userId = this.getUserId(req);

        this.storage
          .create(req, config)
          .then(({ path }) =>
            this.storage.write({ start: 0, contentLength: part.byteCount, body: part, path })
          )
          .then(file => {
            file.status = 'completed';
            const headers = { Location: this.buildFileUrl(req, file) };
            this.send({ res, statusCode: 201, headers, body: file });
            return resolve(file);
          })
          .catch(err => {
            res.setHeader('Connection', 'close');
            return reject(err);
          });
      });

      form.parse(req);
    });
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const path = this.getPath(req);
    if (!path) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(path);
    this.send({ res, statusCode: 204 });
    file.status = 'deleted';
    return file;
  }
}

/**
 * Basic express wrapper
 */
export function multipart(
  options: DiskStorageOptions | { storage: BaseStorage } = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  return new Multipart(options).handle;
}
