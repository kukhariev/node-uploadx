import * as express from 'express';
import { promises } from 'fs';
import { DiskStorageOptions, tus } from '../src';

const app = express();

const opts: DiskStorageOptions = {
  filename: file => `.${file.originalName}`, // dot hide incomplete uploads
  onComplete: async file => {
    console.log('File upload complete: ', file.originalName);
    await promises.rename(file.name, file.originalName); // unhide
  }
};

app.use('/files', [express.static('files'), tus(opts)]);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
