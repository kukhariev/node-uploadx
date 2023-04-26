import * as url from 'url';
import { Checksum, FileInit, UploadxFile } from '../storages';
import { Headers, IncomingMessage, ServerResponse } from '../types';
import { ERRORS, fail, getBaseUrl, getHeader, getJsonBody, setHeaders } from '../utils';
import { BaseHandler, UploadxOptions } from './base-handler';

export function rangeParser(rangeHeader = ''): { start: number; size: number } {
  const parts = rangeHeader.split(/\s+|\//);
  const size = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, size };
}

/**
 * [X-headers protocol implementation](https://github.com/kukhariev/node-uploadx/blob/master/proto.md#requests-overview)
 */
export class Uploadx<TFile extends UploadxFile> extends BaseHandler<TFile> {
  static RESUME_STATUS_CODE = 308;

  /**
   * Create File from request and send a file url to client
   */
  async post(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    const metadata = await this.getMetadata(req);
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req, res);
    config.size = getHeader(req, 'x-upload-content-length');
    config.contentType = getHeader(req, 'x-upload-content-type');
    const file = await this.storage.create(req, config);
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    file.bytesWritten > 0 && (headers['Range'] = `bytes=0-${file.bytesWritten - 1}`);
    setHeaders(res, headers);
    if (file.status === 'completed') return file;
    const response = await this.storage.onCreate(file);
    response.statusCode = file.bytesWritten > 0 ? 200 : 201;
    this.send(res, response);
    return file;
  }

  async patch(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const metadata = await this.getMetadata(req);
    const file = await this.storage.update({ id }, metadata);
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    setHeaders(res, headers);
    if (file.status === 'completed') return file;
    const response = await this.storage.onUpdate(file);
    this.send(res, response);
    return file;
  }

  /**
   * Write a chunk to file or/and return chunk offset
   */
  async put(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const contentRange = getHeader(req, 'content-range');
    const contentLength = +getHeader(req, 'content-length');
    const { start, size = NaN } = contentRange ? rangeParser(contentRange) : { start: 0 };
    const { checksumAlgorithm, checksum } = this.extractChecksum(req);
    const file = await this.storage.write({
      start,
      id,
      body: req,
      size,
      contentLength,
      checksumAlgorithm,
      checksum
    });
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
  async delete(req: IncomingMessage, res: ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const [file] = await this.storage.delete({ id });
    const response = await this.storage.onDelete(file);
    this.send(res, { statusCode: 204, ...response });
    return file;
  }

  getId(req: IncomingMessage): string {
    const { query } = url.parse(req.url || '', true);
    return (query.upload_id || query.prefix || super.getId(req)) as string;
  }

  buildHeaders(file: UploadxFile, headers: Headers = {}): Headers {
    if (file.expiredAt) headers['X-Upload-Expires'] = new Date(file.expiredAt).toISOString();
    return headers;
  }

  /**
   * Build file url from request
   */
  buildFileUrl(
    req: IncomingMessage & { originalUrl?: string },
    file: UploadxFile & { GCSUploadURI?: string }
  ): string {
    if (file.GCSUploadURI) return file.GCSUploadURI;

    const { query, pathname } = url.parse(req.originalUrl || (req.url as string), true);
    query.upload_id = file.id;
    const relative = url.format({ pathname, query });
    return this.storage.config.useRelativeLocation ? relative : getBaseUrl(req) + relative;
  }

  async getMetadata(req: IncomingMessage): Promise<Record<any, any>> {
    const metadata = await getJsonBody(req, this.storage.maxMetadataSize).catch(err =>
      fail(ERRORS.BAD_REQUEST, err)
    );
    if (Object.keys(metadata).length) return metadata;
    const { query } = url.parse(decodeURI(req.url || ''), true);
    return { ...query };
  }

  extractChecksum(req: IncomingMessage): Checksum {
    const contentMD5 = getHeader(req, 'content-md5');
    if (contentMD5) return { checksumAlgorithm: 'md5', checksum: contentMD5 };
    const [type, checksum] = getHeader(req, 'digest').split(/=(.*)/s);
    return { checksumAlgorithm: { sha: 'sha1', 'sha-256': 'sha256' }[type] || type, checksum };
  }
}

/**
 * Basic express wrapper
 * @example
 * ```ts
 * app.use('/files', uploadx({directory: '/tmp', maxUploadSize: '250GB'}));
 * ```
 */
export function uploadx<TFile extends UploadxFile>(
  options: UploadxOptions<TFile> = {}
): (req: IncomingMessage, res: ServerResponse) => void {
  return new Uploadx(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload complete and handle errors and GET requests
 * @example
 * ```ts
 * app.use('/files', uploadx.upload({ storage }), (req, res, next) => {
 *  if (req.method === 'GET') return res.sendStatus(404);
 *  console.log('File upload complete: ', req.body.name);
 *  return res.json(req.body);
 * });
 * ```
 */
uploadx.upload = <TFile extends UploadxFile>(options: UploadxOptions<TFile> = {}) =>
  new Uploadx(options).upload;
