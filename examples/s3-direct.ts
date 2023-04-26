import express from 'express';
import { LogLevel, uploadx } from '@uploadx/core';
import { S3Storage } from '@uploadx/s3';

const PORT = process.env.PORT || 3002;
const app = express();

// The credentials are loaded from a shared credentials file
const storage = new S3Storage({
  bucket: process.env.S3_BUCKET,
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  clientDirectUpload: true, // send presigned urls to the client for upload directly to S3 storage
  partSize: '8MB', // optionally override part size
  expiration: { maxAge: '1h', purgeInterval: '15min' },
  logLevel: <LogLevel>process.env.LOG_LEVEL || 'info'
});

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => console.log('Listening on port:', PORT));
