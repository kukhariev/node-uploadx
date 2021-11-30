/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as express from 'express';
import { promises } from 'fs';
import { join } from 'path';
import { DiskFile, DiskStorageOptions, tus } from '@uploadx/core';

const PORT = process.env.PORT || 3002;

const app = express();
const uploadDirectory = 'upload';
const moveTo = 'files';
const opts: DiskStorageOptions = {
  allowMIME: ['image/*', 'video/*'],
  directory: uploadDirectory
};

app.use('/files', tus.upload(opts), async (req, res) => {
  const file = req.body as DiskFile;
  console.log('File upload complete: ', file.originalName);
  await promises.rename(join(uploadDirectory, file.name), join(moveTo, file.originalName));
  return res.json(file);
});

app.listen(PORT, () => console.log('listening on port:', PORT));
