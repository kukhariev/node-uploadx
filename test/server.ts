import { createHash } from 'crypto';
import * as express from 'express';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { DiskStorage, Uploadx } from '../src';

const auth: express.RequestHandler = (req, res, next) => {
  if (req.headers.authorization) {
    (req as any).user = { id: req.headers.authorization };
  }
  next();
};
const errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
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
const ROOT = `${tmpdir()}/node-uploadx/`;

const onComplete: express.RequestHandler = (req, res) => {
  if (req.file) {
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
  }
};
export const app = express();
export const storage = new DiskStorage({
  dest: (req, file) => `${ROOT}${file.userId}/${file.filename}`
});
export const uploads = new Uploadx({
  storage,
  maxUploadSize,
  allowMIME,
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
