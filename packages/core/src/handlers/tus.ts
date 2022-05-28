import * as http from 'http';
import { Checksum, FileInit, Metadata, UploadxFile } from '../storages';
import { getHeader, Headers, setHeaders, typeis, UploadxResponse } from '../utils';
import { BaseHandler, UploadxOptions } from './base-handler';

export const TUS_RESUMABLE = '1.0.0';
export const TUS_VERSION = '1.0.0';

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
export class Tus<TFile extends UploadxFile> extends BaseHandler<TFile> {
  get extension(): string[] {
    const _extensions = ['creation', 'creation-with-upload', 'termination', 'checksum'];
    if (this.storage.config.expiration) _extensions.push('expiration');
    return _extensions;
  }

  /**
   *  Sends current server configuration
   */
  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const headers = {
      'Tus-Extension': this.extension.toString(),
      'Tus-Max-Size': this.storage.maxUploadSize,
      'Tus-Checksum-Algorithm': this.storage.checksumTypes.toString()
    };
    this.send(res, { statusCode: 204, headers });
    return {} as TFile;
  }

  /**
   * Create a file and send url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const metadataHeader = getHeader(req, 'upload-metadata', true);
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
    const id = await this.getAndVerifyId(req, res);
    const metadataHeader = getHeader(req, 'upload-metadata', true);
    const metadata = metadataHeader && parseMetadata(metadataHeader);
    metadata && (await this.storage.update({ id }, { metadata, id }));
    const start = Number(getHeader(req, 'upload-offset'));
    const contentLength = +getHeader(req, 'content-length');
    const { checksumAlgorithm, checksum } = this.extractChecksum(req);
    const file = await this.storage.write({
      start,
      id,
      body: req,
      contentLength,
      checksumAlgorithm,
      checksum
    });
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
    const id = await this.getAndVerifyId(req, res);
    const file = await this.storage.write({ id });
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
    const id = await this.getAndVerifyId(req, res);
    const [file] = await this.storage.delete({ id });
    this.send(res, { statusCode: 204 });
    return file;
  }

  buildHeaders(file: UploadxFile, headers: Headers = {}): Headers {
    if (file.expiredAt) headers['Upload-Expires'] = new Date(file.expiredAt).toUTCString();
    return headers;
  }

  send(res: http.ServerResponse, { statusCode, headers = {}, body }: UploadxResponse): void {
    headers['Tus-Resumable'] = TUS_RESUMABLE;
    super.send(res, { statusCode, headers, body });
  }

  extractChecksum(req: http.IncomingMessage): Checksum {
    const [checksumAlgorithm, checksum] = getHeader(req, 'upload-checksum')
      .split(/\s+/)
      .filter(Boolean);
    return { checksumAlgorithm, checksum };
  }
}

/**
 * Basic express wrapper
 * @example
 * ```js
 * app.use('/files', tus({directory: '/tmp', maxUploadSize: '250GB'}));
 * ```
 */
export function tus<TFile extends UploadxFile>(
  options: UploadxOptions<TFile> = {}
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return new Tus(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```js
 * app.all('/files', tus.upload({ storage }), (req, res, next) => {
 *   if (req.method === 'GET') return res.sendStatus(404);
 *   console.log('File upload complete: ', req.body.name);
 *   return res.sendStatus(204);
 * });
 * ```
 */
tus.upload = <TFile extends UploadxFile>(options: UploadxOptions<TFile> = {}) =>
  new Tus(options).upload;
