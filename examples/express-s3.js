const express = require('express');
const { tus, S3Storage } = require('node-uploadx');

const app = express();

function onComplete(file) {
  console.log('File upload complete: ', file);
}

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
  region: 'eu-west-3',
  expiration: { maxAge: '1h', purgeInterval: '15min' },
  onComplete
});

app.use('/files', tus({ storage }));

app.listen(3002, () => console.log('Listening on port:', 3002));
