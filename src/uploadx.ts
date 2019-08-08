import * as http from 'http';
import * as querystring from 'querystring';
import * as url from 'url';
import {
  BaseConfig,
  BaseHandler,
  BaseStorage,
  DiskStorageConfig,
  ERRORS,
  fail,
  File
} from './core';
import { DiskStorage } from './disk-storage';
import { getBody } from './utils';
export function rangeParser(rangeHeader = '') {
  const parts = rangeHeader.split(/\s+|\//);
  const total = parseInt(parts[2]);
  const start = parseInt(parts[1]);
  return { start, total };
}
/**
 * X-headers  protocol implementation
 */
export class Uploadx<T> extends BaseHandler<DiskStorageConfig> {
  idKey = 'upload_id';
  storage: BaseStorage<T> | DiskStorage;
  constructor(public options: BaseConfig<T>) {
    super(options);
    this.storage = options.storage || new DiskStorage(options as DiskStorageConfig);
    this.handlers = {
      POST: 'create',
      PUT: 'update',
      DELETE: 'delete',
      GET: 'read'
    };
    this.responseType = 'json';
  }

  /**
   * Build File from `create` request
   */
  protected async buildFileFromRequest(req: http.IncomingMessage): Promise<File> {
    const file = ({} as unknown) as File;
    try {
      if (req.headers['content-type'] || ''.includes('json')) {
        if ('body' in req) {
          file.metadata = req['body'];
        } else {
          const body = (await getBody(req)) as Buffer;
          file.metadata = JSON.parse(body.toString());
        }
      } else {
        return fail(ERRORS.INVALID_CONTENT_TYPE, req.headers['content-type']);
      }
    } catch (error) {
      return fail(ERRORS.BAD_REQUEST, error.message);
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
    const location: string =
      !this.options.useRelativeURL && req.headers.host ? `//${req.headers.host}${uri}` : `${uri}`;
    return location;
  }

  /**
   * Create File from request and send file url to client
   */
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
  async delete(req: http.IncomingMessage, res: http.ServerResponse): Promise<File> {
    const id = this.getFileId(req);
    if (!id) return fail(ERRORS.BAD_REQUEST, 'File id cannot be retrieved');
    const file = await this.storage.delete(id);
    this.send(res, 200, {}, file.metadata);
    file.status = 'deleted';
    return file;
  }
  async read(req: http.IncomingMessage, res: http.ServerResponse): Promise<File[] | undefined> {
    const userId = this.getUserId(req);
    if (userId) {
      return;
    }
    const all = await this.storage.read();
    const files = all.filter(file => file.userId === userId);
    this.send(res, 200, {}, files);
    return files;
  }
}

/**
 * Basic express wrapper
 */
export function uploadx(options: BaseConfig<DiskStorageConfig>) {
  const upl = new Uploadx(options);
  return upl.handle;
}
