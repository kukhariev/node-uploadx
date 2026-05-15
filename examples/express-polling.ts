import { DiskFile, DiskStorage, Uploadx, getUploadxFile } from '@uploadx/core';
import express from 'express';
import { copyFile, mkdir, rm } from 'fs/promises';
import path from 'path';

const PORT = process.env.PORT || 3002;
const app = express();

const uploadDir = process.env.UPLOAD_DIR || 'upload';
const destinationDir = 'files';

mkdir(destinationDir, { recursive: true }).catch(console.error);

const storage = new DiskStorage({
  directory: uploadDir,
  expiration: { maxAge: '1h', purgeInterval: '10min' }
});
const upload = new Uploadx({ storage }).upload;

// Tracks post-upload processing status per file (pending/done/error)
const taskStatus = new Map<string, 'pending' | 'done' | 'error'>();

async function moveFile(file: DiskFile): Promise<void> {
  const src = storage.getFilePath(file.name);
  const dest = path.join(destinationDir, path.basename(file.originalName));

  // prevent path traversal attacks
  if (!dest.startsWith(destinationDir + path.sep)) throw new Error('Invalid path');

  await copyFile(src, dest);
  await rm(src, { force: true });
}

// POST-upload handler: initiates async file move, returns current status
app.use('/files', upload, async (req, res) => {
  const file = getUploadxFile(req);
  if (!file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const { name } = file;

  // Start processing only on first request; subsequent polls reuse existing task
  if (!taskStatus.has(name)) {
    taskStatus.set(name, 'pending');
    moveFile(file)
      .then(() => taskStatus.set(name, 'done'))
      .catch(err => {
        console.error(`Move failed: ${name}`, err);
        taskStatus.set(name, 'error');
      })
      .finally(() => setTimeout(() => taskStatus.delete(name), 30_000));
  }

  const status = taskStatus.get(name)!;

  // 202 Accepted indicates client should poll for completion
  return status === 'pending'
    ? res
        .status(202)
        // .set('Retry-After', '5')
        .json({ ...file, taskStatus: 'pending' })
    : status === 'error'
      ? res.status(422).json({ ...file, taskStatus: 'error' })
      : res.json({ ...file, taskStatus: 'done' });
});

app.listen(PORT, () => console.log(`Listing on port ${PORT}`));
