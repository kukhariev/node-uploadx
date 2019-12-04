import * as http from 'http';
import * as multiparty from 'multiparty';
import { BaseStorage, File, generateFileId, Metadata } from '../storages';
import { DiskStorage, DiskStorageOptions } from '../storages/disk-storage';
import { ERRORS, fail, getHeader, logger } from '../utils';
import { BaseHandler } from './base-handler';

const log = logger.extend('Multipart');

export class Multipart<T extends BaseStorage> extends BaseHandler {
  storage: T | DiskStorage;
  constructor(config: { storage: T } | DiskStorageOptions) {
    super();
    this.storage = 'storage' in config ? config.storage : new DiskStorage(config);
    log('options: %o', config);
  }

  /**
   * Create File from request and send file url to client
   */
  post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();
      const metadata = {} as Metadata;
      form.on('field', (name, value) => {
        Object.assign(metadata, name === 'metadata' ? JSON.parse(value) : { [name]: value });
      });

      form.on('error', err => {
        console.log(err);
      });
      form.on('part', part => {
        metadata.size = part.byteCount;
        metadata.filename = part.filename;
        metadata.type = getHeader(part as any, 'Content-Type');
        const file = new File(metadata);
        file.userId = this.getUserId(req);
        file.id = generateFileId(file);
        this.storage
          .create(req, file)
          .then(({ path }) =>
            this.storage.write({ start: 0, contentLength: part.byteCount, body: part, path })
          )
          .then(file_ => {
            file_.status = 'completed';
            const headers = { Location: this.buildFileUrl(req, file_) };
            this.send({ res, statusCode: 201, headers });
            return resolve(file_);
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
  options: DiskStorageOptions = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  return new Multipart(options).handle;
}
