import * as http from 'http';
import * as url from 'url';
import { BaseStorage, DiskStorageOptions, File, FileInit } from '../storages';
import { ERRORS, fail, getBaseUrl, getHeader, getMetadata, Headers, setHeaders } from '../utils';
import { BaseHandler } from './base-handler';

export function rangeParser(rangeHeader = ''): { start: number; size: number } {
  const parts = rangeHeader.split(/\s+|\//);
  const size = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, size };
}

/**
 * [X-headers protocol implementation](https://github.com/kukhariev/node-uploadx/blob/master/proto.md#requests-overview)
 */
export class Uploadx<TFile extends Readonly<File>> extends BaseHandler<TFile> {
  static RESUME_STATUS_CODE = 308;

  /**
   * Create File from request and send a file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const metadata = await getMetadata(req, this.storage.maxMetadataSize).catch(error =>
      fail(ERRORS.BAD_REQUEST, error)
    );
    const { query } = url.parse(decodeURI(req.url || ''), true);
    Object.assign(metadata, query);
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req, res);
    config.size = getHeader(req, 'x-upload-content-length');
    config.contentType = getHeader(req, 'x-upload-content-type');
    const file = await this.storage.create(req, config);
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    file.bytesWritten > 0 && (headers['Range'] = `bytes=0-${file.bytesWritten - 1}`);
    setHeaders(res, headers);
    if (file.status === 'completed') return file;
    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    this.send(res, { statusCode });
    return file;
  }

  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = this.getId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND);
    const metadata = await getMetadata(req, this.storage.maxMetadataSize).catch(error =>
      fail(ERRORS.BAD_REQUEST, error)
    );
    const { query } = url.parse(decodeURI(req.url || ''), true);
    Object.assign(metadata, query);
    const file = await this.storage.update(id, { metadata, id });
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    this.send(res, { body: file.metadata, headers });
    return file;
  }

  /**
   * Write a chunk to file or/and return chunk offset
   */
  async put(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = this.getId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND);
    const contentRange = getHeader(req, 'content-range');
    const contentLength = +getHeader(req, 'content-length');
    const { start, size = NaN } = contentRange ? rangeParser(contentRange) : { start: 0 };
    const file = await this.storage.write({ id, body: req, start, contentLength, size });
    const headers = this.buildHeaders(file);
    if (file.status === 'completed') return file;
    headers['Range'] = `bytes=0-${file.bytesWritten - 1}`;
    res.statusMessage = 'Resume Incomplete';
    this.send(res, { statusCode: Uploadx.RESUME_STATUS_CODE, headers });

    return file;
  }

  /**
   * Delete upload
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = this.getId(req);
    if (!id) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(id);
    this.send(res, { statusCode: 204 });
    return file;
  }

  getId(req: http.IncomingMessage): string {
    const { query } = url.parse(decodeURI(req.url || ''), true);
    if (query.upload_id) return query.upload_id as string;
    if (query.prefix) return query.prefix as string;
    return super.getId(req);
  }

  buildHeaders(file: File, headers: Headers = {}): Headers {
    if (file.expiredAt) headers['X-Upload-Expires'] = new Date(file.expiredAt).toISOString();
    return headers;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(
    req: http.IncomingMessage & { originalUrl?: string },
    file: File & { GCSUploadURI?: string }
  ): string {
    if (file.GCSUploadURI) return file.GCSUploadURI;

    const { query, pathname } = url.parse(req.originalUrl || (req.url as string), true);
    query.upload_id = file.id;
    const path = url.format({ pathname, query });
    const baseUrl = this.storage.config.useRelativeLocation ? '' : getBaseUrl(req);
    return `${baseUrl}${path}`;
  }
}

/**
 * Basic express wrapper
 * @example
 * app.use('/files', uploadx({directory: '/tmp', maxUploadSize: '250GB'}));
 */
export function uploadx<TFile extends Readonly<File>>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return new Uploadx(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * app.use('/files', uploadx.upload({ storage }), (req, res, next) => {
 *  if (req.method === 'GET') return res.sendStatus(404);
 *  console.log('File upload complete: ', req.body.name);
 *  return res.json(req.body);
 * });
 */
uploadx.upload = <TFile extends Readonly<File>>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile> } = {}
) => new Uploadx(options).upload;
