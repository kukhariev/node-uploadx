import * as express from 'express';
import { type LogLevel, uploadx } from '@uploadx/core';
import { S3Storage } from '@uploadx/s3';

const PORT = process.env.PORT || 3002;
const app = express();

// const storage = new S3Storage({
//   bucket: <YOUR_BUCKET>,
//   endpoint: <YOUR_ENDPOINT>,
//   region: <YOUR_REGION>,
//   credentials: {
//     accessKeyId: <YOUR_ACCESS_KEY_ID>,
//     secretAccessKey: <YOUR_SECRET_ACCESS_KEY>
//   },
//   metaStorageConfig: { directory: 'upload' }
// });

// The credentials are loaded from a shared credentials file
const storage = new S3Storage({
  maxUploadSize: '512MB',
  allowMIME: ['image/*', 'video/*'],
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  expiration: { maxAge: '1h', purgeInterval: '15min' },
  onComplete: file => console.log('File upload complete: ', file),
  logLevel: <LogLevel>process.env.LOG_LEVEL || 'info'
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => console.log('Listening on port:', PORT));
