import * as http from 'http';
import * as multiparty from 'multiparty';
import * as url from 'url';
import { BaseHandler, BaseStorage, ERRORS, fail, File, Metadata } from './core';
import { DiskStorage, DiskStorageOptions } from './core/DiskStorage';
import { getBaseUrl, getHeader, logger } from './core/utils';

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
      form.on('part', part => {
        metadata.size = part.byteCount;
        metadata.filename = part.filename;
        metadata.type = getHeader(part as any, 'Content-Type');
        const file = new File(metadata);
        file.userId = this.getUserId(req);
        file.generateId();
        this.storage
          .create(req, file)
          .then(() => this.storage.write(part, { ...file, start: 0 }))
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
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND);
    const userId = this.getUserId(req);
    const [file] = await this.storage.delete({ id, userId });
    this.send({ res, statusCode: 204 });
    file.status = 'deleted';
    return file;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, file: File): string {
    const originalUrl = 'originalUrl' in req ? req['originalUrl'] : req.url || '';
    const { pathname, query } = url.parse(originalUrl, true);
    const path = url.format({ pathname: `${pathname}/${file.id}`, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return baseUrl ? `${baseUrl}${path}` : `${path}`;
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
