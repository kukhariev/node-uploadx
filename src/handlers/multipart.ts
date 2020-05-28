import * as http from 'http';
import * as multiparty from 'multiparty';
import { BaseStorage, File, FileInit } from '../storages';
import { DiskStorage, DiskStorageOptions } from '../storages/disk-storage';
import { ERRORS, fail } from '../utils';
import { BaseHandler } from './base-handler';

export class Multipart<TFile extends Readonly<File>, L> extends BaseHandler {
  storage: BaseStorage<TFile, L>;

  constructor(config: { storage: BaseStorage<TFile, L> } | DiskStorageOptions) {
    super();
    this.storage =
      'storage' in config
        ? config.storage
        : ((new DiskStorage(config) as unknown) as BaseStorage<TFile, L>);
    this.responseType = 'json';
    this.log('options: %o', config);
  }

  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    return new Promise((resolve, reject) => {
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
        part.on('error', error => null);
        this.storage
          .create(req, config)
          .then(created =>
            this.storage.write({
              start: 0,
              contentLength: part.byteCount,
              body: part,
              name: created.name
            })
          )
          .then(file => {
            if (file.status === 'completed') {
              const headers = { Location: this.buildFileUrl(req, file) };
              this.send({ res, statusCode: 201, headers, body: file });
            }
            return resolve(file);
          })
          .catch(err => reject(err));
      });

      form.parse(req);
    });
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(name);
    this.send({ res, statusCode: 204 });
    return file;
  }
}

/**
 * Basic express wrapper
 */
export function multipart<T extends Readonly<File>, L>(
  options: DiskStorageOptions | { storage: BaseStorage<T, L> } = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: () => void) => void {
  return new Multipart(options).handle;
}
