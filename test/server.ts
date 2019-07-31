import { createHash } from 'crypto';
import * as express from 'express';

import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { DiskStorage, File, Uploadx } from '../src';

const auth = (req, res, next) => {
  if (req.headers.authorization) {
    req['user'] = { id: '5678', name: 'user656', password: 'password1234' };
  }
  next();
};
const errorHandler = (err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details
    }
  });
};

const PORT = 3003;
const maxUploadSize = '6000MB';
const allowMIME = ['video/*'];
const maxChunkSize = '8MB';
const DEST_ROOT = `${tmpdir()}/ngx/`;
const app = express();

class DiskStorageEx extends DiskStorage {
  // override
  // allow to get list of all files
  list(): Promise<File[]> {
    return Promise.resolve(Object.values(this.metaStore.all));
  }
}
export const storage = new DiskStorageEx({
  dest: (req, file) => `${DEST_ROOT}${req.user.id}/${file.filename}`
});
export const uploads = new Uploadx({ storage, maxUploadSize, allowMIME });

app.use(auth);
app.use('/upload' as any, uploads.handle, onComplete);
app.use(errorHandler);

export const server = app.listen(PORT);

function onComplete(req, res) {
  if (!req.file) {
    res.send();
    return;
  }
  const hash = createHash('md5');
  const input = createReadStream(req.file.path);
  input.on('readable', () => {
    const data = input.read();
    if (data) {
      hash.update(data);
    } else {
      const md5 = hash.digest('hex');
      res.json({ ...req.file, md5 });
    }
  });
}
