import { uploadx } from '@uploadx/core';
import express from 'express';

const PORT = process.env.PORT || 3002;

const app = express();

const uploads = uploadx({
  directory: process.env.UPLOAD_DIR || 'upload',
  maxUploadSize: '5GB',
  allowMIME: ['video/*', 'image/*'],
  filename: file => file.originalName,
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  onComplete: file => {
    console.log('File upload complete: ', file.originalName);
    return file;
  }
});

app.use('/files', uploads);

app.listen(PORT, () => console.log('listening on port:', PORT));
