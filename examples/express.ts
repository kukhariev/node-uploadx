import * as express from 'express';
import { promises } from 'fs';
import { DiskFile, DiskStorage, Multipart, OnComplete, Uploadx } from '../src';

const app = express();
const auth: express.Handler = (req, res, next) => {
  (req as any).user = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};

app.use(auth);

const onComplete: OnComplete<DiskFile> = async file => {
  const srcpath = `upload/${file.name}`;
  const dstpath = `files/${file.originalName}`;
  await promises.mkdir('files', { recursive: true });
  promises.link(srcpath, dstpath);
  const message = `File upload is finished, path: ${dstpath}`;
  console.log(message);
  (file as any).message = message;
};

const storage = new DiskStorage({
  allowMIME: ['video/*', 'image/*'],
  directory: 'upload',
  onComplete
});
const uploadx = new Uploadx({ storage });
const multipart = new Multipart({ storage });

app.use('/files', express.static('files'));
app.use('/upload/files', uploadx.handle);
app.use('/files', multipart.handle);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
