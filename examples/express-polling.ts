import { DiskFile, DiskStorage, Uploadx } from '@uploadx/core';
import { copyFile } from 'fs/promises';
import express from 'express';
import path from 'path';

const PORT = process.env.PORT || 3002;

const app = express();

type Moving = { status: 'moving' | 'error' | 'done' };

const processes = {} as Record<string, Moving>;

const uploadDirectory = process.env.UPLOAD_DIR || 'upload';
const moveTo = 'files';

const storage = new DiskStorage({ directory: uploadDirectory });

const onComplete: express.RequestHandler = (req, res) => {
  const file = req.body as DiskFile;
  const moving = (processes[file.name] ??= {} as Moving);
  if (!moving.status) {
    moving.status = 'moving';
    void (async () => {
      try {
        const source = storage.getFilePath(file.name);
        const destination = path.resolve(moveTo, file.originalName);
        if (!destination.startsWith(path.resolve(moveTo))) {
          throw new Error(`Invalid destination path: ${destination}`);
        }
        await copyFile(source, destination);
        await storage.delete(file);
        moving.status = 'done';
      } catch (e) {
        console.error(e);
        moving.status = 'error';
      }
    })();
  }
  if (moving.status === 'error') {
    res.status(422).json({ ...file, moving });
    delete processes[file.name];
  } else if (moving.status === 'done') {
    res.json({ ...file, moving });
    delete processes[file.name];
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
