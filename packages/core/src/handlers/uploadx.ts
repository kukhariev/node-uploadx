import * as http from 'http';
import * as url from 'url';
import { Checksum, FileInit, UploadxFile } from '../storages';
import { ERRORS, fail, getBaseUrl, getHeader, getMetadata, Headers, setHeaders } from '../utils';
import { BaseHandler, UploadxOptions } from './base-handler';

export function rangeParser(rangeHeader = ''): { start: number; size: number } {
  const parts = rangeHeader.split(/\s+|\//);
  const size = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, size };
}
const CHECKSUM_TYPES_MAP: Record<string, string> = {
  sha: 'sha1',
  'sha-256': 'sha256'
};

export function normalizeChecksumType(type: string): string {
  return CHECKSUM_TYPES_MAP[type] || type;
}

/**
 * [X-headers protocol implementation](https://github.com/kukhariev/node-uploadx/blob/master/proto.md#requests-overview)
 */
export class Uploadx<TFile extends UploadxFile> extends BaseHandler<TFile> {
  static RESUME_STATUS_CODE = 308;

  /**
   * Create File from request and send a file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
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
    const statusCode = file.bytesWritten > 0 ? 200 : 201;
    this.send(res, { statusCode });
    return file;
  }

  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const metadata = await this.getMetadata(req);
    const file = await this.storage.update({ id }, { metadata, id });
    const headers = this.buildHeaders(file, { Location: this.buildFileUrl(req, file) });
    this.send(res, { body: file.metadata, headers });
    return file;
  }

  /**
   * Write a chunk to file or/and return chunk offset
   */
  async put(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
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
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const id = await this.getAndVerifyId(req, res);
    const [file] = await this.storage.delete({ id });
    this.send(res, { statusCode: 204 });
    return file;
  }

  getId(req: http.IncomingMessage): string {
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
    req: http.IncomingMessage & { originalUrl?: string },
    file: UploadxFile & { GCSUploadURI?: string }
  ): string {
    if (file.GCSUploadURI) return file.GCSUploadURI;

    const { query, pathname } = url.parse(req.originalUrl || (req.url as string), true);
    query.upload_id = file.id;
    const relative = url.format({ pathname, query });
    return this.storage.config.useRelativeLocation ? relative : getBaseUrl(req) + relative;
  }

  async getMetadata(req: http.IncomingMessage): Promise<Record<any, any>> {
    const metadata = await getMetadata(req, this.storage.maxMetadataSize).catch(error =>
      fail(ERRORS.BAD_REQUEST, error)
    );
    if (Object.keys(metadata).length) return metadata;
    const { query } = url.parse(decodeURI(req.url || ''), true);
    return { ...metadata, ...query };
  }

  extractChecksum(req: http.IncomingMessage): Checksum {
    const [_type, checksum] = getHeader(req, 'digest').split(/=(.*)/s);
    return { checksumAlgorithm: normalizeChecksumType(_type), checksum };
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
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
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
