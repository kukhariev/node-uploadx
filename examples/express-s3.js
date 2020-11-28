const express = require('express');
const { tus, S3Storage } = require('node-uploadx');

const app = express();

function onComplete(file) {
  console.log('File upload complete: ', file);
}

const storage = new S3Storage({ bucket: 'node-uploadx', onComplete });

app.use('/files', tus({ storage }));

app.listen(3003, () => console.log('Listening on port:', 3003));
