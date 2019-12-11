const express = require('express');
const { multipart, S3Storage } = require('../dist');

const app = express();

const storage = new S3Storage({ bucket: 'node-uploadx' });

app.use('/files', multipart({ storage }));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
