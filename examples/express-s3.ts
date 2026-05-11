import express from 'express';
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

// The credentials are loaded from a environment
const storage = new S3Storage({
  bucket: 'my-bucket',
  maxUploadSize: '5TB',
  logLevel: <LogLevel>process.env.LOG_LEVEL || 'info',
  onComplete: file => console.log('File upload complete: ', file)
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => console.log('Listening on port:', PORT));
