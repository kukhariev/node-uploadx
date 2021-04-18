import * as express from 'express';
import { promises } from 'fs';
import { DiskFile, DiskStorage, OnComplete, uploadx } from 'node-uploadx';

const app = express();

const auth: express.Handler = (req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (req as any)['user'] = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};

app.use(auth);

const onComplete: OnComplete<DiskFile> = async file => {
  const srcpath = `upload/${file.name}`;
  const dstpath = `files/${file.originalName}`;
  await promises.mkdir('files', { recursive: true });
  await promises.link(srcpath, dstpath);
  const message = `File upload is finished, path: ${dstpath}`;
  console.log(message);
  return {
    message,
    id: file.id
  };
};

const storage = new DiskStorage({
  allowMIME: { value: ['video/*'], message: 'Only Video files is supported.', statusCode: 415 },
  maxUploadSize: { value: '1GB', message: 'File is too big.', statusCode: 413 },
  directory: 'upload',
  onComplete
});

app.use('/files', express.static('files'), uploadx({ storage }));

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
