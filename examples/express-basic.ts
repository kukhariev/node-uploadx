import { uploadx } from '@uploadx/core';
import express from 'express';

const PORT = process.env.PORT || 3002;

const app = express();

const uploads = uploadx({
  uploadDir: process.env.UPLOAD_DIR || 'upload',
  maxFileSize: '5GB',
  allowedMimeTypes: ['video/*', 'image/*'],
  namingFunction: file => file.originalName,
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  onComplete: file => {
    console.log('File upload complete: ', file.originalName);
    return file;
  }
});

app.use('/files', uploads);

app.listen(PORT, () => console.log('listening on port:', PORT));
