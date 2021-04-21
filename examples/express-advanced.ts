/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as express from 'express';
import { DiskStorage, uploadx } from '@uploadx/core';

const app = express();

const storage = new DiskStorage({
  allowMIME: { value: ['video/*'], message: 'Only Video files is supported.', statusCode: 415 },
  maxUploadSize: { value: '1GB', message: 'File is too big.', statusCode: 413 },
  directory: 'files',
  filename: file => `${file.id}-${file.originalName}`
});

const errorRequestHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  return res.status(err.statusCode || err.status || 500).json(err);
};

app.use('/files', uploadx.upload({ storage }), async (req, res, next) => {
  if (req.method === 'GET') {
    return res.json(req.body);
  }
  console.log('File upload complete: ', req.body.originalName);
  return res.json(req.body);
});

app.use(errorRequestHandler);

app.listen(3003, () => console.log('listening on port:', 3003));
