import { DiskFile, DiskStorage, Uploadx } from '@uploadx/core';
import { createHash } from 'crypto';
import * as express from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';
import { completedRetryGuard } from './completed-retry-guard';

const app = express();

const uploadDirectory = 'upload';

const fileHash: (filePath: string) => Promise<string> = filePath =>
  new Promise(resolve => {
    const hash = createHash('sha256');
    createReadStream(filePath)
      .on('data', data => hash.update(data))
      .on('end', () => resolve(hash.digest('hex')));
  });

const storage = new DiskStorage({ directory: uploadDirectory });

const onComplete: express.RequestHandler = async (req, res, next) => {
  const file = req.body as DiskFile;
  try {
    const sha256 = await fileHash(join(uploadDirectory, file.name));
    res.finishUpload({ statusCode: 200, body: { id: file.id, sha256 } });
  } catch (error) {
    res.finishUpload({ statusCode: 422, body: { error: 'File hash calculation error' } });
  }
};

const uploadx = new Uploadx({ storage });

app.all('/files', uploadx.upload, completedRetryGuard({ statusCode: 202 }, 60), onComplete);

app.listen(3002, () => console.log('listening on port:', 3002));
