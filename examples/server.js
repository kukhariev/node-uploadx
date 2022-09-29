const { multipart, tus, uploadx } = require('@uploadx/core');
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3002;
const app = express();

function buildRedirectUrl(req) {
  const { uploadType = 'uploadx' } = req.query;
  return `/${uploadType}`;
}

const apiRedirect = (req, res, next) => {
  res.redirect(308, buildRedirectUrl(req));
  next();
};

const opts = {
  directory: 'upload',
  maxUploadSize: '2GB',
  allowMIME: ['video/*', 'image/*'],
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  logLevel: process.env.LOG_LEVEL || 'info'
};

app.use(cors());
app.use(apiRedirect);

app.use('/uploadx', uploadx(opts));
app.use('/tus', tus(opts));
app.use('/multipart', multipart({ ...opts, maxUploadSize: '100MB' }));

app.listen(PORT, () => console.log('listening on port:', PORT));
