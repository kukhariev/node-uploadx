import { DiskStorageOptions, uploadx } from '@uploadx/core';
import * as express from 'express';

const PORT = process.env.PORT || 3002;

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

app.use('files', uploadx(opts));

app.listen(PORT, () => console.log('listening on port:', PORT));
