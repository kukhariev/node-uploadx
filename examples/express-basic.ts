import { DiskStorageOptions, uploadx } from '@uploadx/core';
import * as express from 'express';

const app = express();

const opts: DiskStorageOptions = {
  maxUploadSize: '1GB',
  allowMIME: ['video/*', 'image/*'],
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  onComplete: file => {
    console.log('File upload complete: ', file);
    return file;
  }
};

app.use('/files', express.static('files'));

app.use('/upload/files', uploadx(opts));

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
