import { createHash } from 'crypto';
import * as express from 'express';
import { createReadStream } from 'fs';
import { tmpdir } from 'os';
import { DiskStorage, Uploadx } from '../src';
import { errorHandler } from './error-handler';

const PORT = 3003;
const maxUploadSize = '180MB';
const allowMIME = ['video/*'];

const app = express();
app.enable('trust proxy');

const storage = new DiskStorage({ dest: (req, file) => `${tmpdir()}/ngx/${file.filename}` });
const uploads = new Uploadx({ storage, maxUploadSize, allowMIME });

app.use('/upload' as any, uploads.handle, onComplete);
app.use(errorHandler);

export const server = app.listen(PORT, 'localhost');

function onComplete(req: any, res) {
  const hash = createHash('md5');
  const input = createReadStream(req.file.path);
  input.on('readable', () => {
    const data = input.read();
    if (data) hash.update(data);
    else {
      const md5 = hash.digest('hex');
      // console.log('\x1b[36m%s\x1b[0m', `\n<<<COMPLETED>>> ${md5} ${req.file.path}`);
      res.json({ ...req.file, md5 });
    }
  });
}
