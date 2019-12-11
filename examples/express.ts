import * as express from 'express';
import { linkSync } from 'fs';
import { join } from 'path';
import { DiskStorage, File, Multipart, Uploadx } from '../src';

const app = express();

app.use(express.json());

const onComplete = ({ path, filename }: File): void => {
  const srcpath = join('upload', path);
  const dstpath = join('files', filename);
  try {
    linkSync(srcpath, dstpath);
    console.log(`upload complete, path: ${srcpath}, public path: ${dstpath}`);
  } catch (error) {
    console.error(error);
  }
};

const storage = new DiskStorage({ directory: 'upload' });
const uploadx = new Uploadx({ storage });
const multipart = new Multipart({ storage });
uploadx.on('completed', onComplete);
multipart.on('completed', onComplete);

app.use('/files', express.static('files'));
app.use('/upload/files', uploadx.handle);
app.use('/files', multipart.handle);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
