import { uploadx } from '@uploadx/core';
import { S3Storage, fromEnv } from '@uploadx/s3';
import express from 'express';

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
//   metaStorageOptions: { directory: 'upload' }
// });

// The credentials are loaded from a environment
const storage = new S3Storage({
  bucket: 'my-bucket',
  maxFileSize: '5TB',
  ...fromEnv(),
  onComplete: file => {
    const message = `File upload complete: ${file.originalName}`;
    console.log(message);
    return message;
  }
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => console.log('Listening on port:', PORT));
