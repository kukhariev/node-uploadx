import express from 'express';
import { DiskStorage, type OnComplete, uploadx } from 'node-uploadx';

const PORT = process.env.PORT || 3002;

const app = express();

const onComplete: OnComplete = file => {
  const message = `File upload is finished, path: ${file.name}`;
  console.log(message);
  return {
    statusCode: 200,
    message,
    id: file.id,
    headers: { ETag: file.id }
  };
};

const storage = new DiskStorage({
  uploadDir: process.env.UPLOAD_DIR || 'upload',
  onComplete,
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  validation: {
    mime: { value: ['video/*'], response: [415, { message: 'video only' }] },
    size2: {
      isValid(file) {
        this.response = [412, { message: `The file size (${file.size}) is larger than 1GiB` }];
        return file.size <= 1024 * 1024 * 1024;
      }
    },
    mtime: {
      isValid: file => !!file.metadata.lastModified,
      response: [403, { message: 'Missing `lastModified` property' }]
    }
  }
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => {
  console.log('listening on port:', PORT);
});
