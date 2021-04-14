import * as express from 'express';
import { multipart, uploadx, DiskStorageOptions } from '@uploadx/core';

const app = express();

const opts: DiskStorageOptions = {
  onComplete: file => {
    console.log('File upload complete: ', file);
    return file.status;
  }
};

app.use('/files', express.static('files'));

app.use('/files', multipart(opts));

app.use('/upload/files', uploadx(opts));

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
