import * as http from 'http';
import * as querystring from 'querystring';
import * as url from 'url';
import {
  BaseConfig,
  BaseHandler,
  BaseStorage,
  DiskStorageOptions,
  ERRORS,
  fail,
  File,
  Route
} from './core';
import { DiskStorage } from './disk-storage';
import { getBody, typeis } from './utils';

export function rangeParser(rangeHeader = '') {
  const parts = rangeHeader.split(/\s+|\//);
  const total = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, total };
}
/**
 * X-headers  protocol implementation
 */
export class Uploadx extends BaseHandler {
  idKey = 'upload_id';
  storage: BaseStorage;
  constructor(public options: BaseConfig) {
    super(options);
    this.storage = options.storage || new DiskStorage(options as DiskStorageOptions);
    this.responseType = 'json';
  }

  /**
   * Create File from request and send file url to client
   */
  @Route('POST')
  @Route('PATCH')
  async create(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    let file = await this.buildFileFromRequest(req);
    await this.checkLimits(file);
    file = await this.storage.create(req, file);
    const statusCode = file.bytesWritten ? 200 : 201;
    const location = this.buildFileUrl(req, file.id);
    res.setHeader('Access-Control-Expose-Headers', 'Location');
    res.setHeader('Location', location);
    this.send(res, statusCode);
    file.status = 'created';
    return file;
  }

  /**
   * Write chunk to file or/and return chunk offset
   */
  @Route('PUT')
  async update(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const contentLength = Number(req.headers['content-length']);
    const contentRange = req.headers['content-range'];
    const { start, total } = contentRange
      ? rangeParser(contentRange)
      : { start: 0, total: contentLength };
    const file = await this.storage.update(req, { start, total, id });
    if (file.bytesWritten < file.size) {
      res.setHeader('Access-Control-Expose-Headers', 'Range');
      res.setHeader('Range', `bytes=0-${file.bytesWritten - 1}`);
      this.send(res, 308);
    } else {
      file.status = 'completed';
    }
    return file;
  }

  /**
   * Delete upload by id
   */
  @Route('DELETE')
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const file = await this.storage.delete(id);
    this.send(res, 200, {}, file.metadata);
    file.status = 'deleted';
    return file;
  }
  @Route('GET')
  async read(req: http.IncomingMessage, res: http.ServerResponse) {
    const userId = this.getUserId(req);
    const id = this.getFileId(req);
    const all = (await this.storage.read(id)) as File[];
    const files = all.filter(file => file.userId === userId);
    this.send(res, 200, {}, files);
    return files;
  }

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: http.IncomingMessage): Promise<File> {
    const file = ({} as unknown) as File;
    file.id = this.getFileId(req) as string;

    if (typeis.hasBody(req) && typeis(req, ['json'])) {
      if ('body' in req) {
        file.metadata = req['body'];
      } else {
        try {
          const body = (await getBody(req)) as Buffer;
          file.metadata = JSON.parse(body.toString());
        } catch (error) {
          return fail(ERRORS.BAD_REQUEST, error.message);
        }
      }
    } else {
      return fail(ERRORS.INVALID_CONTENT_TYPE, req.headers['content-type']);
    }

    file.userId = this.getUserId(req);
    file.filename = file.metadata.name || file.metadata.title;
    file.size = +(req.headers['x-upload-content-length'] || file.metadata.size);
    file.mimeType = req.headers['x-upload-content-type'] || file.metadata.mimeType;
    return file;
  }

  /**
   * Get id from request
   */
  protected getFileId(req: http.IncomingMessage): string | undefined {
    const { query } = url.parse(req.url || '', true);
    return query[this.idKey] as string;
  }

  /**
   * Build file url from request
   */
  protected buildFileUrl(req: http.IncomingMessage, id: string): string {
    const { query, pathname } = url.parse(req.url || '', true);
    const baseUrl = 'baseUrl' in req ? req['baseUrl'] : pathname || '';
    const uri = `${baseUrl}?${querystring.stringify({ ...query, ...{ [this.idKey]: id } })}`;
    const location: string = req.headers.host ? `//${req.headers.host}${uri}` : `${uri}`;
    return location;
  }
}

/**
 * Basic express wrapper
 */
export function uploadx(options: BaseConfig & DiskStorageOptions) {
  const upl = new Uploadx(options);
  return upl.handle;
}
