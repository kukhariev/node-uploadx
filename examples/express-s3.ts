import * as express from 'express';
import { LogLevel, uploadx } from '@uploadx/core';
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
  bucket: 'node-uploadx',
  endpoint: 'http://127.0.0.1:9000',
  forcePathStyle: true,
  expiration: { maxAge: '1h', purgeInterval: '15min' },
  onComplete: file => console.log('File upload complete: ', file),
  // logger: console
  logLevel: <LogLevel>process.env.LOG_LEVEL || 'info'
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => console.log('Listening on port:', PORT));
