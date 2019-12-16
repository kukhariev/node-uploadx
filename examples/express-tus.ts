import * as express from 'express';
import { DiskStorageOptions, tus } from '../src';

const app = express();

const opts: DiskStorageOptions = {
  onComplete: file => {
    console.log('File upload complete: ', file);
  }
};

app.use('/files', [express.static('files'), tus(opts)]);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
