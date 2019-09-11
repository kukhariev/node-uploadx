/* eslint-disable no-console */

import * as express from 'express';
import { DiskStorage, Uploadx } from '../src';

const auth: express.RequestHandler = (req, res, next): void => {
  if (req.headers.authorization) {
    (req as any).user = { id: req.headers.authorization };
  }
  next();
};

const maxUploadSize = '6GB';
const allowMIME = ['video/*'];
export const UPLOADS_DIR = `./upload/node-uploadx-test/`;

export const app = express();
export const storage = new DiskStorage({
  dest: (req, file) => `${UPLOADS_DIR}${file.userId}/${file.filename}`,
  maxUploadSize,
  allowMIME,
  useRelativeLocation: true
});
export const uploads = new Uploadx({ storage });

app.use(auth);

app.use('/upload', uploads.handle);

app.get('/upload', (req, res) => {
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
