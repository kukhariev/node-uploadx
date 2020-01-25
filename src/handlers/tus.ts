import * as bytes from 'bytes';
import * as http from 'http';
import { DiskStorage, DiskStorageOptions } from '../storages/disk-storage';
import { File, FileInit, Metadata } from '../storages/file';
import { BaseStorage } from '../storages/storage';
import { ERRORS, fail, getHeader, typeis } from '../utils';
import { BaseHandler, Headers } from './base-handler';

export const TUS_RESUMABLE = '1.0.0';
export function serializeMetadata(obj: Metadata): string {
  return Object.entries(obj)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString('base64')}`)
    .toString();
}

export function parseMetadata(encoded = ''): Metadata {
  const kvPairs = encoded.split(',').map(kv => kv.split(' '));
  const metadata = Object.create(null);
  for (const [key, value] of kvPairs) {
    if (!value || !key) return metadata;
    metadata[key] = Buffer.from(value, 'base64').toString();
  }
  return metadata;
}
/**
 * tus resumable upload protocol
 * @link https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md
 */
export class Tus<T extends BaseStorage> extends BaseHandler {
  storage: T | DiskStorage;
  constructor(config: { storage: T } | DiskStorageOptions) {
    super();
    this.storage = 'storage' in config ? config.storage : new DiskStorage(config);
    this.log('options: %o', config);
  }

  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const headers: Headers = {
      'Tus-Extension': 'creation,creation-with-upload,termination',
      'Tus-Version': TUS_RESUMABLE,
      'Tus-Resumable': TUS_RESUMABLE,
      'Tus-Max-Size': bytes.parse(this.storage.config.maxUploadSize || 0)
    };
    res.setHeader('Content-Length', 0);
    res.writeHead(204, headers);
    res.end();
    return Promise.resolve({} as File);
  }

  /**
   * Create File from request and send file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = parseMetadata(metadataHeader);
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req);
    config.size = getHeader(req, 'upload-length');
    let file = await this.storage.create(req, config);
    const headers: Headers = {
      Location: this.buildFileUrl(req, file),
      'Tus-Resumable': TUS_RESUMABLE
    };
    if (typeis(req, ['application/offset+octet-stream'])) {
      const contentLength = +getHeader(req, 'content-length');
      file = await this.storage.write({ ...file, start: 0, body: req, contentLength });
      headers['Upload-Offset'] = file.bytesWritten;
      file.status = file.bytesWritten === file.size ? 'completed' : 'part';
    }
    const statusCode = file.bytesWritten === file.size || file.bytesWritten === 0 ? 201 : 200;
    this.send({ res, statusCode, headers });
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = metadataHeader && parseMetadata(metadataHeader);
    metadata && (await this.storage.update(name, { metadata, name }));
    const start = Number(getHeader(req, 'upload-offset'));
    const contentLength = +getHeader(req, 'content-length');
    const file = await this.storage.write({ start, name, body: req, contentLength });
    const headers: Headers = {
      'Upload-Offset': `${file.bytesWritten}`,
      'Tus-Resumable': TUS_RESUMABLE
    };
    this.send({ res, statusCode: 204, headers });
    file.status = file.bytesWritten === file.size ? 'completed' : 'part';
    return file;
  }

  async head(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const file = await this.storage.write({ name: name });
    const headers: Headers = {
      'Upload-Offset': `${file.bytesWritten}`,
      'Upload-Metadata': serializeMetadata(file.metadata),
      'Tus-Resumable': TUS_RESUMABLE
    };
    this.send({ res, statusCode: 200, headers });
    return file;
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const name = this.getName(req);
    if (!name) return fail(ERRORS.FILE_NOT_FOUND);
    const [file] = await this.storage.delete(name);
    const headers: Headers = { 'Tus-Resumable': TUS_RESUMABLE };
    this.send({ res, statusCode: 204, headers });
    file.status = 'deleted';
    return file;
  }
}

/**
 * Basic express wrapper
 */
export function tus(
  options: DiskStorageOptions | { storage: BaseStorage } = {}
): (req: http.IncomingMessage, res: http.ServerResponse, next: Function) => void {
  return new Tus(options).handle;
}
