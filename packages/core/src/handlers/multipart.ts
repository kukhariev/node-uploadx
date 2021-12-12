import * as http from 'http';
import * as multiparty from 'multiparty';
import { BaseStorage, DiskStorageOptions, File, FileInit } from '../storages';
import { setHeaders } from '../utils';
import { BaseHandler } from './base-handler';

interface MultipartyPart extends multiparty.Part {
  headers: {
    [key: string]: any;
    'content-type': string;
  };
}

export class Multipart<TFile extends Readonly<File>> extends BaseHandler<TFile> {
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();
      const config: FileInit = { metadata: {} };
      form.on('field', (key, value) => {
        Object.assign(config.metadata, key === 'metadata' ? JSON.parse(value) : { [key]: value });
      });
      form.on('error', error => reject(error));
      form.on('part', (part: MultipartyPart) => {
        config.size = part.byteCount;
        config.originalName = part.filename;
        config.contentType = part.headers['content-type'];
        config.userId = this.getUserId(req, res);
        part.on('error', error => null);
        this.storage
          .create(req, config)
          .then(({ id }) =>
            this.storage.write({ start: 0, contentLength: part.byteCount, body: part, id })
          )
          .then(file => {
            if (file.status === 'completed') {
              const headers = { Location: this.buildFileUrl(req, file) };
              setHeaders(res, headers);
            }
            return resolve(file);
          })
          .catch(err => reject(err));
      });

      form.parse(req);
    });
  }

  /**
   * Delete upload
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const [file] = await this.storage.delete({ id });
    this.send(res, { statusCode: 204 });
    return file;
  }
}

/**
 * Basic express wrapper
 * @example
 * app.use('/files', multipart({directory: '/tmp', maxUploadSize: '250GB'}));
 */
export function multipart<TFile extends Readonly<File>>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return new Multipart(options).handle;
}
/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * app.use('/files', multipart.upload({ storage }), (req, res, next) => {
 *   if (req.method === 'GET') return res.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return res.sendStatus(200);
 * });
 */
multipart.upload = <TFile extends Readonly<File>>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
) => new Multipart(options).upload;
