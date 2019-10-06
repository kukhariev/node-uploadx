/* eslint-disable no-console */
process.argv.includes('--log') && (process.env.DEBUG = 'uploadx:*');

import * as express from 'express';
import { createHash } from 'crypto';
import { DiskStorage, Tus, Uploadx } from '../src';

const auth: express.RequestHandler = (req, res, next): void => {
  if (req.headers.authorization) {
    (req as any).user = {
      id: createHash('md5')
        .update(req.headers.authorization)
        .digest('hex')
        .substr(5)
    };
  }
  next();
};

const maxUploadSize = '6GB';
const allowMIME = ['video/*'];
export const UPLOADS_DIR = `./upload/node-uploadx-test/`;

DiskStorage.EXPIRY_SCAN_PERIOD = 10_000;
const EXPIRE = 25 / 84_000;

export const app = express();
export const storage = new DiskStorage({
  dest: (req, file) => `${UPLOADS_DIR}${file.userId || 'anonymous'}/${file.filename}`,
  maxUploadSize,
  allowMIME,
  useRelativeLocation: true,
  expire: EXPIRE
});
export const uploadx = new Uploadx({ storage });
export const tus = new Tus({ storage });

app.use(auth);
app.use((req, res, next) => {
  req.url = req.headers['tus-resumable'] ? '/tus' + req.url : '/uploadx' + req.url;
  next();
});
app.use('/tus/upload', tus.handle);
app.use('/uploadx/upload', uploadx.handle);

app.get('/*/upload', (req, res) => {
  console.log(req.body);

  res.json(req.body);
});

if (!module.parent) {
  app.listen(3003, error => {
    if (error) {
      return console.error('something bad happened', error);
    }
    console.log('listening on port:', 3003);
  });
}
