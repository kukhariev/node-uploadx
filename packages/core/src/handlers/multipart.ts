import multiparty from 'multiparty';
import { FileInit, UploadxFile } from '../storages';
import { IncomingMessage, ServerResponse } from '../types';
import { setHeaders } from '../utils';
import { BaseHandler, UploadxOptions } from './base-handler';

interface MultipartyPart extends multiparty.Part {
  headers: {
    [key: string]: any;
    'content-type': string;
  };
}

export class Multipart<TFile extends UploadxFile> extends BaseHandler<TFile> {
  /** @experimental */
  errorMode: 'drain' | 'abort' =
    process.env['MULTIPART_ERROR_MODE'] === 'abort' ? 'abort' : 'drain';

  async post(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    return new Promise((resolve, reject) => {
      const form = new multiparty.Form();
      const config: FileInit = { metadata: {} };
      let rejected = false;

      const onError = (error: Error): void => {
        if (rejected) return;
        rejected = true;
        if (this.errorMode === 'drain' && req.readable && !req.destroyed) {
          form.removeAllListeners();
          req.unpipe();

          req.on('readable', () => {
            while (req.read() !== null) {
              /* drain */
            }
          });

          req.once('close', () => reject(error));
          req.once('end', () => reject(error));
        } else {
          reject(error);
        }
      };

      form.on('field', (key, value) => {
        try {
          Object.assign(config.metadata, key === 'metadata' ? JSON.parse(value) : { [key]: value });
        } catch {
          config.metadata.raw = value;
        }
      });
      form.on('error', error => onError(error));
      form.on('part', (part: MultipartyPart) => {
        config.size = part.byteCount;
        config.originalName = part.filename;
        config.contentType = part.headers['content-type'];
        config.userId = this.getUserId(req, res);
        part.on('error', _ => null);
        this.storage
          .create(req, config)
          .then(({ id }) =>
            this.storage.write({ start: 0, contentLength: part.byteCount, body: part, id })
          )
          .then(file => {
            if (rejected) return;
            if (file.status === 'completed') {
              const headers = { Location: this.buildFileUrl(req, file) };
              setHeaders(res, headers);
            }
            return resolve(file);
          })
          .catch((error: Error) => {
            part.destroy();
            onError(error);
          });
      });

      form.parse(req);
    });
  }

  /**
   * Delete upload
   */
  async delete(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const [file] = await this.storage.delete({ id });
    this.send(res, { statusCode: 204 });
    return file;
  }
}

/**
 * Basic express wrapper
 * @example
 * ```ts
 * app.use('/files', multipart({uploadDir: '/tmp', maxFileSize: '250GB'}));
 * ```
 */
export function multipart<TFile extends UploadxFile>(
  options: UploadxOptions<TFile> = {}
): (req: IncomingMessage, res: ServerResponse) => void {
  return new Multipart(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```ts
 * app.use('/files', multipart.upload({ storage }), (req, res, next) => {
 *   if (req.method === 'GET') return res.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return res.sendStatus(200);
 * });
 * ```
 */
multipart.upload = <TFile extends UploadxFile>(options: UploadxOptions<TFile> = {}) =>
  new Multipart(options).upload;
