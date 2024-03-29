// @ts-check
const { cors, DiskStorage, Multipart, Tus, Uploadx } = require('@uploadx/core');
const { createServer } = require('http');
const url = require('url');

const PORT = process.env.PORT || 3002;
const path = '/files';
const pathRegexp = new RegExp(`^${path}([/?]|$)`);

const config = {
  path,
  directory: process.env.UPLOAD_DIR || 'upload',
  allowMIME: process.env.ALLOW_MIME?.split(',') || ['video/*', 'image/*'],
  maxUploadSize: process.env.MAX_UPLOAD_SIZE || '2GB',
  expiration: { maxAge: process.env.MAX_AGE || '1h', purgeInterval: '10min' },
  logLevel: /** @type { 'info' } */ (process.env.LOG_LEVEL || 'info')
};

const corsHandler = cors();
const storage = new DiskStorage(config);
const uploadx = new Uploadx({ storage });
const tus = new Tus({ storage });
const multipart = new Multipart({ storage });

createServer((req, res) => {
  const { pathname, query = { uploadType: '' } } = url.parse(req.url ?? '', true);
  if (pathname === '/healthcheck') {
    const healthcheck = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      message: 'status 👍',
      timestamp: Date.now()
    };
    corsHandler(req, res, () => uploadx.send(res, { body: healthcheck }));
  } else if (pathname && pathRegexp.test(pathname)) {
    switch (query.uploadType) {
      case 'multipart':
        multipart.handle(req, res);
        break;
      case 'tus':
        tus.handle(req, res);
        break;
      default:
        uploadx.handle(req, res);
        break;
    }
  } else {
    corsHandler(req, res, () => uploadx.send(res, { body: 'Not Found', statusCode: 404 }));
  }
}).listen(PORT);
