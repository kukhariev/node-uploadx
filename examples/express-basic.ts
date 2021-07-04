import { DiskStorageOptions, multipart, uploadx } from '@uploadx/core';
import * as express from 'express';

const app = express();

const opts: DiskStorageOptions = {
  maxUploadSize: '1GB',
  allowMIME: ['video/*', 'image/*'],
  onComplete: file => {
    console.log('File upload complete: ', file);
    return file.status;
  }
};

app.use('/files', express.static('files'));

app.use('/files', multipart(opts));

app.use('/upload/files', uploadx(opts));

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
