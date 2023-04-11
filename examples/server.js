const { multipart, tus, uploadx } = require('@uploadx/core');
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 3002;
const opts = {
  directory: 'upload',
  allowMIME: ['video/*', 'image/*'],
  maxUploadSize: process.env.MAX_UPLOAD_SIZE || '2GB',
  expiration: { maxAge: process.env.MAX_AGE || '1h', purgeInterval: '10min' },
  logLevel: process.env.LOG_LEVEL || 'info',
  onComplete: file => {
    console.log('File upload complete: ', file);
    return file;
  }
};

const app = express();

function buildRedirectUrl(req) {
  const { uploadType = 'uploadx' } = req.query;
  return `/${uploadType}`;
}

const apiRedirect = (req, res, next) => {
  res.redirect(308, buildRedirectUrl(req));
  next();
};

app.get('/healthcheck', (req, res) => {
  const healthcheck = {
    memoryUsage: process.memoryUsage(),
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now()
  };
  res.send(healthcheck);
});

app.use(cors());

app.use('/uploadx', uploadx(opts));
app.use('/tus', tus(opts));
app.use('/multipart', multipart({ ...opts, maxUploadSize: '100MB' }));

app.use(apiRedirect);

app.listen(PORT, () => console.log('listening on port:', PORT));
