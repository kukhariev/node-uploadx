const express = require('express');
const cors = require('cors');
const { uploadx } = require('../../dist');
const { auth } = require('./auth');
const { errorHandler } = require('./error-handler');
const tmpdir = require('os').tmpdir();
const app = express();
app.enable('trust proxy');
const corsOptions = {
  exposedHeaders: ['Range', 'Location']
};
app.use(cors(corsOptions));
app.use(express.json());

app.use(auth);

app.use(
  '/upload/',
  uploadx({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: (req, file) => `${tmpdir}/${file.id}`
  }),
  (req, res) => res.json(req.file)
);

app.use(errorHandler);

app.listen(3003);
