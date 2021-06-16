import * as http from 'http';
import { BaseStorage, DiskStorageOptions, File, FileInit, Metadata } from '../storages';
import { ERRORS, fail, getHeader, typeis } from '../utils';
import { BaseHandler, Headers, SendParameters } from './base-handler';

export const TUS_RESUMABLE = '1.0.0';

export function serializeMetadata(obj: Metadata): string {
  return Object.entries(obj)
    .map(([key, value]) => `${key} ${Buffer.from(String(value)).toString('base64')}`)
    .toString();
}

export function parseMetadata(encoded = ''): Metadata {
  const kvPairs = encoded.split(',').map(kv => kv.split(' '));
  const metadata = Object.create(null) as Record<string, string>;
  for (const [key, value] of kvPairs) {
    if (!value || !key) {
      return metadata;
    }
    metadata[key] = Buffer.from(value, 'base64').toString();
  }
  return metadata;
}

/**
 * tus resumable upload protocol
 * @link https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md
 */
export class Tus<TFile extends Readonly<File>, TList> extends BaseHandler<TFile, TList> {
  async options(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const headers: Headers = {
      'Tus-Extension': 'creation,creation-with-upload,termination',
      'Tus-Version': TUS_RESUMABLE,
      'Tus-Max-Size': this.storage.maxUploadSize
    };
    this.send(res, { statusCode: 204, headers });
    return {} as TFile;
  }

  /**
   * Create File from request and send file url to client
   */
  async post(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = parseMetadata(metadataHeader);
    const config: FileInit = { metadata };
    config.userId = this.getUserId(req, res);
    config.size = getHeader(req, 'upload-length');
    let file = await this.storage.create(req, config);
    const headers: Headers = {
      Location: this.buildFileUrl(req, file)
    };
    if (typeis(req, ['application/offset+octet-stream'])) {
      getHeader(req, 'expect') && this.send(res, { statusCode: 100 });
      const contentLength = +getHeader(req, 'content-length');
      file = await this.storage.write({ ...file, start: 0, body: req, contentLength });
      headers['Upload-Offset'] = file.bytesWritten;
    }
    const statusCode = file.bytesWritten === file.size || file.bytesWritten === 0 ? 201 : 200;
    this.send(res, { statusCode, headers });
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  async patch(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) {
      return fail(ERRORS.FILE_NOT_FOUND);
    }
    const metadataHeader = getHeader(req, 'upload-metadata');
    const metadata = metadataHeader && parseMetadata(metadataHeader);
    metadata && (await this.storage.update(name, { metadata, name }));
    const start = Number(getHeader(req, 'upload-offset'));
    const contentLength = +getHeader(req, 'content-length');
    const file = await this.storage.write({ start, name, body: req, contentLength });
    if (file.status) {
      const headers: Headers = {
        'Upload-Offset': `${file.bytesWritten}`
      };
      file.status === 'part' && this.send(res, { statusCode: 204, headers });
    }
    return file;
  }

  async head(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) {
      return fail(ERRORS.FILE_NOT_FOUND);
    }
    const file = await this.storage.write({ name: name });
    const headers: Headers = {
      'Upload-Offset': `${file.bytesWritten}`,
      'Upload-Metadata': serializeMetadata(file.metadata)
    };
    this.send(res, { statusCode: 200, headers });
    return {} as TFile;
  }

  /**
   * Delete upload by id
   */
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<TFile> {
    const name = this.getName(req);
    if (!name) {
      return fail(ERRORS.FILE_NOT_FOUND);
    }
    const [file] = await this.storage.delete(name);
    this.send(res, { statusCode: 204 });
    return file;
  }

  finish(req: http.IncomingMessage, res: http.ServerResponse, file: File): void {
    const headers: Headers = {
      'Upload-Offset': `${file.bytesWritten}`,
      'Upload-Metadata': serializeMetadata(file.metadata)
    };
    return this.send(res, { statusCode: 204, headers });
  }

  send(res: http.ServerResponse, { statusCode, headers = {}, body }: SendParameters): void {
    headers['Tus-Resumable'] = TUS_RESUMABLE;
    super.send(res, { statusCode, headers, body });
  }
}

/**
 * Basic express wrapper
 * @example
 * app.use('/files', tus({directory: '/tmp', maxUploadSize: '250GB'}));
 */
export function tus<TFile extends File, TList>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile, TList> } = {}
): (req: http.IncomingMessage, res: http.ServerResponse) => void {
  return new Tus(options).handle;
}

/**
 * Express wrapper
 *
 * - express ***should*** respond to the client when the upload is complete and handle errors and GET requests
 * @example
 * app.use('/files', tus.upload({ storage }), (req, res, next) => {
  if (req.method === 'GET') {
    return res.sendStatus(404);
  }
  console.log('File upload complete: ', req.body.name);
  return res.sendStatus(204);
});
 */
tus.upload = <TFile extends Readonly<File>, TList>(
  options: DiskStorageOptions | { storage: BaseStorage<TFile, TList> }
) => new Tus(options).upload;
