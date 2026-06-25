// @ts-check
const { cors, DiskStorage, Multipart, Tus, Uploadx, fromEnv } = require('@uploadx/core');
const { createServer } = require('http');

const PORT = process.env.PORT || 3002;
const path = '/files';
const pathRegexp = new RegExp(`^${path}([/?]|$)`);

const config = {
  basePath: path,
  uploadDir: './upload',
  allowedMimeTypes: ['video/*', 'image/*'],
  maxFileSize: '2GB',
  expiration: { maxAge: process.env.MAX_AGE || '1h', purgeInterval: '10min' },
  ...fromEnv()
};

const corsHandler = cors();
const storage = new DiskStorage(config);
const uploadx = new Uploadx({ storage });
const tus = new Tus({ storage });
const multipart = new Multipart({ storage });

createServer((req, res) => {
  const { pathname, searchParams } = new URL(req.url ?? '', 'http://localhost');
  if (pathname === '/healthcheck') {
    const healthcheck = {
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      message: 'status 👍',
      timestamp: Date.now()
    };
    corsHandler(req, res, () => uploadx.send(res, { body: healthcheck }));
  } else if (pathname && pathRegexp.test(pathname)) {
    switch (searchParams.get('uploadType')) {
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
