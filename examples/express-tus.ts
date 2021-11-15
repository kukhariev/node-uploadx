/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as express from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { DiskFile, DiskStorageOptions, tus } from '@uploadx/core';

const app = express();
const dest = 'files';
const opts: DiskStorageOptions = {
  allowMIME: ['image/*', 'video/*'],
  directory: dest
};

app.use('/files', express.static(dest), tus.upload(opts), async (req, res) => {
  const file = req.body as DiskFile;
  console.log('File upload complete: ', req.body.originalName);
  await promises.rename(join(dest, file.name), join(dest, file.originalName)); // unhide
  return res.json(file);
});

app.listen(3002, () => console.log('listening on port:', 3002));
