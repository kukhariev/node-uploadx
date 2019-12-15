/* eslint-disable no-console */
process.argv.includes('--log') && (process.env.DEBUG = 'uploadx:*');

import * as express from 'express';
import { DiskStorage, Multipart, Tus, Uploadx } from '../src';
export const userId = 'userId';
export const uploadDir = `files`;
const auth: express.RequestHandler = (req, res, next): void => {
  (req as any).user = { id: userId };
  next();
};

const app = express();
app.use(auth);
export const storage = new DiskStorage({
  directory: `${uploadDir}`,
  filename: file => `${file.userId}/${file.filename}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*'],
  useRelativeLocation: true
});
export const upx = new Uploadx({ storage });
export const tus = new Tus({ storage });
export const mpt = new Multipart({ storage });

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
process.on('uncaughtException', err => console.log(err));
export { app };
if (!module.parent) {
  app.listen(3003, error => {
    if (error) {
      return console.error('something bad happened', error);
    }
    console.log('listening on port:', 3003);
  });
}
