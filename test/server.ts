/* eslint-disable no-console */
process.argv.includes('--log') && (process.env.DEBUG = 'uploadx:*');

import * as express from 'express';
import { DiskStorage, Multipart, Tus, Uploadx } from '../src';

const auth: express.RequestHandler = (req, res, next): void => {
  if (req.headers.authorization) {
    (req as any).user = { id: req.headers.authorization };
  }
  next();
};

const maxUploadSize = '6GB';
const allowMIME = ['video/*', 'image/*'];
export const UPLOADS_DIR = `files`;

// DiskStorage.EXPIRY_SCAN_PERIOD = 10_000;
// const EXPIRE = 25 / 84_000;

export const app = express();
export const storage = new DiskStorage({
  directory: `${UPLOADS_DIR}`,
  filename: file => `${file.userId || ''}/${file.filename}`,
  maxUploadSize,
  allowMIME,
  // expire: EXPIRE,
  useRelativeLocation: true
});
export const upx = new Uploadx({ storage });
export const tus = new Tus({ storage });
export const mpt = new Multipart({ storage });

app.use(auth);
app.use((req, res, next) => {
  const isMultipart = (req.headers['content-type'] || '').startsWith('multipart/');
  const isTus = req.headers['tus-resumable'];
  const prefix = isTus ? '/tus' : isMultipart ? '/mpt' : '/upx';
  req.url = prefix + req.url;
  next();
});
app.use('/tus/upload', tus.handle);
app.use('/upx/upload', upx.handle);
app.use('/mpt/upload', mpt.handle);

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});
app.on('error', err => console.log(err));
process.on('uncaughtException', function(err) {
  console.log('process.on handler');
  console.log(err);
});

if (!module.parent) {
  app.listen(3003, error => {
    if (error) {
      return console.error('something bad happened', error);
    }
    console.log('listening on port:', 3003);
  });
}
