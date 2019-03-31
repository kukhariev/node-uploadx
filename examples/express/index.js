const express = require('express');
const { uploadx } = require('../../dist');
const { auth } = require('./auth');
const { errorHandler } = require('./error-handler');
const tmpdir = require('os').tmpdir();
const app = express();
app.use(express.json());
app.use(auth);

app.use(
  '/upload/',
  uploadx({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: tmpdir
  }),
  (req, res) => {
    console.log(`file upload complete:\n`, req.file);
    res.json(req.file);
  }
);

app.use(errorHandler);

const server = app.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
