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

  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    return new Promise((resolve, reject) => {
      req.on('error', error => reject(error));
      const form = new multiparty.Form();
      const config: FileInit = { metadata: {} };
      form.on('field', (key, value) => {
        Object.assign(config.metadata, key === 'metadata' ? JSON.parse(value) : { [key]: value });
      });
      form.on('error', error => reject(error));
      form.on('part', (part: multiparty.Part) => {
        config.size = part.byteCount;
        config.originalName = part.filename;
        config.contentType = part.headers['content-type'];
        config.userId = this.getUserId(req);

        this.storage
          .create(req, config)
          .then(({ name }) =>
            this.storage.write({ start: 0, contentLength: part.byteCount, body: part, name })
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
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(name);
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
