/* eslint-disable no-console */

import { createHash } from 'crypto';
import * as express from 'express';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { DiskStorage, Uploadx, File } from '../src';

const auth: express.RequestHandler = (req, res, next): void => {
  if (req.headers.authorization) {
    (req as any).user = { id: req.headers.authorization };
  }
  next();
};
const errorHandler: express.ErrorRequestHandler = (err, req, res, next): void => {
  !err.statusCode && console.log(err);
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details
    }
  });
};
export class ExtendedUploadX extends Uploadx {
  async get(req: express.Request, res: express.Response): Promise<File[]> {
    const userId = this.getUserId(req);
    const id = this.getFileId(req);
    const files = await this.storage.get({ id, userId });
    id ? res.download(files[0].path) : res.json(files);
    return files;
  }
}
const maxUploadSize = '6GB';
const allowMIME = ['video/*'];
export const UPLOADS_DIR = `${tmpdir()}/node-uploadx-test/`;

const onComplete: express.RequestHandler = (req, res): void => {
  if (req.body) {
    const hash = createHash('md5');
    const input = createReadStream(req.body.path);
    input.on('readable', () => {
      const data = input.read();
      if (data) {
        hash.update(data);
      } else {
        const md5 = hash.digest('hex');
        res.json({ ...req.body, md5 });
      }
    });
  }
};
export const app = express();
export const storage = new DiskStorage({
  dest: (req, file) => `${UPLOADS_DIR}${file.userId}/${file.filename}`,
  maxUploadSize,
  allowMIME
});
export const uploads = new ExtendedUploadX({
  storage,
  useRelativeLocation: true
});

app.use(auth);
app.use('/upload', uploads.handle, onComplete);
app.use(errorHandler);

if (!module.parent) {
  app.listen(3003, error => {
    if (error) {
      return console.error('something bad happened', error);
    }
    console.log('listening on port:', 3003);
  });
}
