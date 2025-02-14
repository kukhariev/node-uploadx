import express from 'express';
import { DiskFile, DiskStorageOptions, tus } from '@uploadx/core';

const PORT = process.env.PORT || 3002;

const app = express();
const opts: DiskStorageOptions = {
  allowMIME: ['image/*', 'video/*'],
  directory: process.env.UPLOAD_DIR || 'upload'
};

app.use('/files', tus.upload(opts), (req, res) => {
  const file = req.body as DiskFile;
  console.log('File upload complete: ', file.originalName);
  return res.json(file);
});

app.listen(PORT, () => console.log('listening on port:', PORT));
