import * as express from 'express';
import { linkSync, mkdirSync } from 'fs';
import { DiskStorage, File, Multipart, Uploadx } from '../src';

const app = express();
const auth: express.Handler = (req, res, next) => {
  (req as any).user = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};

app.use(auth);

const onComplete = ({ name, originalName }: File): void => {
  const srcpath = `upload/${name}`;
  const dstpath = `files/${originalName}`;
  try {
    mkdirSync('files', { recursive: true });
    linkSync(srcpath, dstpath);
    console.log(`File upload is finished, path: ${dstpath}`);
  } catch (error) {
    console.error(error);
  }
};

const storage = new DiskStorage({ allowMIME: ['video/*', 'image/*'], directory: 'upload' });
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
