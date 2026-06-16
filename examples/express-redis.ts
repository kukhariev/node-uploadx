import { uploadx, RedisMetaStorage, fromEnv } from '@uploadx/core';
import express from 'express';

const PORT = process.env.PORT || 3002;

const app = express();

const uploads = uploadx({
  uploadDir: 'upload',
  metaStorage: new RedisMetaStorage(),
  maxFileSize: '5GB',
  allowedMimeTypes: ['video/*', 'image/*'],
  expiration: { maxAge: '30min', purgeInterval: '5min', rolling: true },
  onComplete: file => {
    console.log('File upload complete: ', file.originalName);
    return file;
  },
  ...fromEnv()
});

app.use('/files', uploads);

app.listen(PORT, () => console.log('listening on port:', PORT));
