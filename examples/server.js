// @ts-check
const { cors, DiskStorage, Multipart, Tus, Uploadx, fromEnv } = require('@uploadx/core');
const { createServer } = require('http');

const PORT = process.env.PORT || 3002;

const config = {
  basePath: '/files',
  uploadDir: './upload',
  allowedMimeTypes: ['video/*', 'image/*'],
  maxFileSize: '2GB',
  expiration: { maxAge: process.env.MAX_AGE || '1h', purgeInterval: '10min' },
  ...fromEnv()
};

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
    cors()(req, res, () => uploadx.send(res, { body: healthcheck }));
  } else {
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
  }
}).listen(PORT);
