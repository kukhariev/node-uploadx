/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as express from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { DiskStorageOptions, tus } from '@uploadx/core';

const app = express();
const dir = 'files';
const opts: DiskStorageOptions = {
  allowMIME: ['image/*', 'video/*'],
  directory: dir,
  filename: file => `.${file.originalName}` // dot hide incomplete uploads
};

app.use('/files', express.static(dir), tus.upload(opts), async (req, res) => {
  if (req.method === 'GET') {
    return res.json(req.body);
  }
  console.log('File upload complete: ', req.body.originalName);
  await promises.rename(join(dir, req.body.name), join(dir, req.body.originalName)); // unhide
  return res.sendStatus(204);
});

app.listen(3003, () => console.log('listening on port:', 3003));
