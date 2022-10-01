import { DiskFile, DiskStorage, Uploadx } from '@uploadx/core';
import { copyFile } from 'cp-file';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';

const PORT = process.env.PORT || 3002;

const app = express();

type Moving = { percent: number; status: 'moving' | 'error' | 'done' };

const processes = {} as Record<string, Moving>;

const uploadDirectory = 'upload';
const moveTo = 'files';

const storage = new DiskStorage({ directory: uploadDirectory });

const onComplete: express.RequestHandler = (req, res) => {
  const file = req.body as DiskFile;
  const moving = (processes[file.name] ??= {} as Moving);
  if (!moving.status) {
    moving.status = 'moving';
    const source = path.resolve(uploadDirectory, file.name);
    const destination = path.resolve(moveTo, file.originalName);
    void (async () => {
      try {
        await copyFile(source, destination, {
          onProgress: ({ percent }) => {
            moving.percent = percent * 100;
          }
        });
        await fs.promises.unlink(source);
        moving.status = 'done';
      } catch (e) {
        console.error(e);
        moving.status = 'error';
      }
    })();
  }
  if (moving.status === 'error') {
    res.status(422).json({ ...file, moving });
  } else if (moving.status === 'done') {
    res.json({ ...file, moving });
  } else {
    res
      .status(202)
      // .set('Retry-After', '5') // override polling interval
      .json({ ...file, moving });
  }
};

const uploadx = new Uploadx({ storage });

app.use('/files', uploadx.upload, onComplete);

app.listen(PORT, () => console.log('listening on port:', PORT));
