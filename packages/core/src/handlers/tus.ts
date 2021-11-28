import * as http from 'http';
import { BaseStorage, DiskStorageOptions, File, FileInit, Metadata } from '../storages';
import { ERRORS, fail, getHeader, Headers, setHeaders, typeis, UploadxResponse } from '../utils';
import { BaseHandler } from './base-handler';

export const TUS_RESUMABLE = '1.0.0';

export function serializeMetadata(obj: Metadata): string {
  return Object.entries(obj)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString('base64')}`)
    .toString();
}

export function parseMetadata(encoded = ''): Metadata {
  const kvPairs = encoded.split(',').map(kv => kv.split(' '));
  const metadata = Object.create(Metadata.prototype) as Record<string, string>;
  for (const [key, value] of kvPairs) {
    if (key) metadata[key] = value ? Buffer.from(value, 'base64').toString() : '';
  }
  return metadata;
}

/**
 * [tus resumable upload protocol](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md)
 */
export class Tus<TFile extends Readonly<File>> extends BaseHandler<TFile> {
  get extension(): string[] {
    const _extensions = ['creation', 'creation-with-upload', 'termination'];
    if (this.storage.config.expiration) _extensions.push('expiration');
    return _extensions;
  }

  /**
   *  Sends current server configuration
   */
  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const headers = {
      'Tus-Extension': this.extension.toString(),
      'Tus-Max-Size': this.storage.maxUploadSize
    };
    this.send(res, { statusCode: 204, headers });
    return {} as TFile;
  }

  /**
   * Create a file and send url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = parseMetadata(metadataHeader);
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req, res);
    config.size = getHeader(req, 'upload-length');
    let file = await this.storage.create(req, config);
    // 'creation-with-upload' block
    if (typeis(req, ['application/offset+octet-stream'])) {
      const contentLength = +getHeader(req, 'content-length');
      file = await this.storage.write({ ...file, start: 0, body: req, contentLength });
    }
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    file.bytesWritten > 0 && (headers['Upload-Offset'] = file.bytesWritten);
    setHeaders(res, headers);
    if (file.status === 'completed') return file;
    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    this.send(res, { statusCode });
    return file;
  }

  /**
   * Write a chunk to file
   */
  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = metadataHeader && parseMetadata(metadataHeader);
    metadata && (await this.storage.update(name, { metadata, name }));
    const start = Number(getHeader(req, 'upload-offset'));
    const contentLength = +getHeader(req, 'content-length');
    const file = await this.storage.write({ start, name, body: req, contentLength });
    const headers = this.buildHeaders(file, { 'Upload-Offset': file.bytesWritten });
    setHeaders(res, headers);
    if (file.status === 'completed') return file;
    this.send(res, { statusCode: 204 });
    return file;
  }

  /**
   * Return chunk offset
   */
  async head(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const file = await this.storage.write({ name: name });
    const headers = this.buildHeaders(file, {
      'Upload-Offset': file.bytesWritten,
      'Upload-Length': file.size,
      'Upload-Metadata': serializeMetadata(file.metadata)
    });
    this.send(res, { statusCode: 200, headers });
    return {} as TFile;
  }

  /**
   * Delete upload
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(name);
    this.send(res, { statusCode: 204 });
    return file;
  }

  buildHeaders(file: File, headers: Headers = {}): Headers {
    if (file.expiredAt) headers['Upload-Expires'] = new Date(file.expiredAt).toUTCString();
    return headers;
  }

  send(res: http.ServerResponse, { statusCode, headers = {}, body }: UploadxResponse): void {
    headers['Tus-Resumable'] = TUS_RESUMABLE;
    super.send(res, { statusCode, headers, body });
  }
}

/**
 * Basic express wrapper
 * @example
 * app.use('/files', tus({directory: '/tmp', maxUploadSize: '250GB'}));
 */
export function tus<TFile extends File>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return new Tus(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * app.all('/files', tus.upload({ storage }), (req, res, next) => {
 *   if (req.method === 'GET') return res.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return res.sendStatus(204);
 * });
 */
tus.upload = <TFile extends Readonly<File>>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
) => new Tus(options).upload;
