/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as express from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { DiskFile, DiskStorageOptions, tus } from '@uploadx/core';

const app = express();
const dir = 'files';
const opts: DiskStorageOptions = {
  allowMIME: ['image/*', 'video/*'],
  directory: dir,
  filename: file => `.${file.originalName}` // dot hide incomplete uploads
};

app.use('/files', express.static(dir), tus.upload(opts), async (req, res) => {
  const file = req.body as DiskFile;
  if (req.method === 'GET') {
    return res.json(req.body);
  }
  console.log('File upload complete: ', req.body.originalName);
  await promises.rename(join(dir, file.name), join(dir, file.originalName)); // unhide
  return res.sendStatus(204);
});

app.listen(3002, () => console.log('listening on port:', 3002));
