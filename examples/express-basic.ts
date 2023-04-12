import { LogLevel, uploadx } from '@uploadx/core';
import * as express from 'express';

const PORT = process.env.PORT || 3002;

const app = express();

const uploads = uploadx({
  directory: process.env.UPLOAD_DIR || 'upload',
  maxUploadSize: '1GB',
  allowMIME: ['video/*', 'image/*'],
  useRelativeLocation: true,
  filename: file => file.originalName,
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  logLevel: <LogLevel>process.env.LOG_LEVEL || 'info',
  onComplete: file => {
    console.log('File upload complete: ', file);
    return file;
  }
});

app.use('/files', uploads);

app.listen(PORT, () => console.log('listening on port:', PORT));
