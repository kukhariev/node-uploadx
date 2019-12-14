import * as express from 'express';
import { linkSync, mkdirSync } from 'fs';
import { DiskStorage, File, Multipart, Uploadx } from '../src';

const app = express();

const onFileUploadComplete = ({ path, filename }: File): void => {
  const srcpath = `upload/${path}`;
  const dstpath = `files/${filename}`;
  try {
    mkdirSync('files', { recursive: true });
    linkSync(srcpath, dstpath);
    console.log(`File upload is finished, path: ${srcpath}, public path: ${dstpath}`);
  } catch (error) {
    console.error(error);
  }
};

const storage = new DiskStorage({ allowMIME: ['video/*', 'image/*'], directory: 'upload' });
const uploadx = new Uploadx({ storage });
const multipart = new Multipart({ storage });
uploadx.on('completed', onFileUploadComplete);
multipart.on('completed', onFileUploadComplete);

app.use('/files', express.static('files'));
app.use('/upload/files', uploadx.handle);
app.use('/files', multipart.handle);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
