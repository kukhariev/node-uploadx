import { createHash } from 'crypto';
import * as express from 'express';
import { NextFunction, Request, Response } from 'express';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { DiskStorage, Uploadx } from '../src';

const auth = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers.authorization) {
    (req as any).user = { id: '5678', name: 'user656', password: 'password1234' };
  }
  next();
};
const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  !err.statusCode && console.log(err);
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details
    }
  });
};

const maxUploadSize = '6GB';
const allowMIME = ['video/*'];
const DEST_ROOT = `${tmpdir()}/node-uploadx/`;

const onComplete = (req: Request, res: Response) => {
  const hash = createHash('md5');
  const input = createReadStream(req.file.path);
  input.on('readable', () => {
    const data = input.read();
    if (data) {
      hash.update(data);
    } else {
      const md5 = hash.digest('hex');
      res.json({ ...req.file, md5 });
    }
  });
};
export const app = express();
export const storage = new DiskStorage({
  dest: (req, file) => `${DEST_ROOT}${file.userId}/${file.filename}`
});
export const uploads = new Uploadx({ storage, maxUploadSize, allowMIME });

app.use(auth);
app.use('/upload' as any, uploads.handle, onComplete);
app.use(errorHandler);
