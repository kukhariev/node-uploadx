import * as bytes from 'bytes';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import * as createError from 'http-errors';
import * as getRawBody from 'raw-body';
import { Store, UploadxFile } from './storage';
import debug = require('debug');
const log = debug('uploadx:main');

declare global {
  namespace Express {
    interface Request {
      user: any;
      file: UploadxFile;
    }
  }
}

export type UploadxConfig = {
  destination?: string | ((req: Request) => string);
  maxUploadSize?: number | string;
  maxChunkSize?: number | string;
  allowMIME?: string[];
  useRelativeURL?: boolean;
};

export function uploadx({
  destination,
  maxUploadSize = Number.MAX_SAFE_INTEGER,
  maxChunkSize = Number.MAX_SAFE_INTEGER,
  allowMIME = [`\/`],
  useRelativeURL = false
}: UploadxConfig): (
  req: Request,
  res: Response,
  next: NextFunction
) => RequestHandler {
  // init database
  const storage = new Store(destination);

  /**
   * Create new
   */
  const create: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    const mimetype = req.get('x-upload-content-type');
    const size = +req.get('x-upload-content-length');
    if (!mimetype) {
      return next();
    }
    if (!req.user) {
      return next(createError(401));
    }

    if (size > bytes.parse(maxUploadSize)) {
      return next(createError(413));
    }
    if (!new RegExp(allowMIME.join('|')).test(mimetype)) {
      return next(createError(415));
    }

    const file: UploadxFile = storage.create(req);
    if (file.destination) {
      const search = Object.keys(req.query).reduce(
        (acc, key) => acc + `&${key}=${req.query[key]}`,
        `?upload_id=${file.id}`
      );
      const location = useRelativeURL
        ? `${req.baseUrl}${search}`
        : `//${req.get('host')}${req.baseUrl}${search}`;
      log('location: %s', location);
      res.location(location);
      res.sendStatus(201);
    } else {
      next(createError(500));
    }
  };

  /**
   * List sessions
   */
  const find: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return next(createError(401));
    }
    if (req.query.upload_id) {
      const [file] = storage.findByUser(req.user, req.query.upload_id);
      if (!file) {
        return next(createError(404));
      }
      res.json(file);
    } else {
      res.json(storage.findByUser(req.user));
    }
  };

  /**
   * Cancel upload session
   */
  const remove: RequestHandler = (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.user) {
      return next(createError(401));
    }
    if (!req.query.upload_id) {
      return next(createError(400));
    }
    const [toRemove] = storage.findByUser(req.user, req.query.upload_id);
    if (toRemove) {
      storage.remove(toRemove.id);
      res.sendStatus(204);
    } else {
      return next(createError(404));
    }
  };

  /**
   * Save content
   */
  const save: RequestHandler = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.query.upload_id) {
      return next(createError(404));
    }
    const file = storage.findById(req.query.upload_id);
    if (!file) {
      return next(createError(404));
    }
    if (+req.get('content-length') > maxChunkSize) {
      return next(createError(413));
    }
    const contentRange = req.get('content-range');
    // ---------- resume upload ----------
    if (contentRange && contentRange.includes('*')) {
      const [, total] = contentRange.match(/\*\/(\d+)/g).map(s => +s);
      if (total === file.bytesWritten) {
        req.file = Object.assign({}, file);
        storage.remove(file.id);
        return next();
      } else {
        res.set('Range', `bytes=0-${file.bytesWritten - 1}`);
        res.status(308).send('Resume Incomplete');
        return;
      }
    }
    try {
      const buf = await getRawBody(req, { limit: maxChunkSize });
      if (!contentRange) {
        // -------- full file --------
        await file.write(buf, 0);
        req.file = Object.assign({}, file);
        storage.remove(file.id);
        next();
      } else {
        // --------- by chunks ---------
        const [, start, end, total] = contentRange
          .match(/(\d+)-(\d+)\/(\d+)/)
          .map(s => +s);
        await file.write(buf, start);
        if (file.bytesWritten < total) {
          res.set('Range', `bytes=0-${file.bytesWritten - 1}`);
          res.status(308).send('Resume Incomplete');
        } else {
          req.file = Object.assign({}, file);
          storage.remove(file.id);
          next();
        }
      }
    } catch (err) {
      next(createError(500));
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    log(
      '%s\n%s\nquery: %o\nheaders: %o',
      req.baseUrl,
      req.method,
      req.query,
      req.headers
    );
    let handler: RequestHandler = (
      req: Request,
      res: Response,
      next: NextFunction
    ) => {
      return next();
    };
    switch (req.method) {
      case 'PUT':
        handler = save(req, res, next);
        break;
      case 'POST':
        handler = create(req, res, next);
        break;
      case 'GET':
        handler = find(req, res, next);
        break;
      case 'DELETE':
        handler = remove(req, res, next);
        break;
      default:
        break;
    }
    return handler;
  };
}
