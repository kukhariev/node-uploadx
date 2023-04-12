// @ts-check
const { createServer } = require('http');
const { parse } = require('url');
const { DiskStorage, Uploadx } = require('@uploadx/core');

const PORT = process.env.PORT || 3002;

const storage = new DiskStorage({
  directory: process.env.UPLOAD_DIR || 'upload',
  path: '/files',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });

uploads.on('error', error => console.error('error: ', error));
uploads.on('created', ({ originalName }) => console.log('created: ', originalName));
uploads.on('part', ({ originalName }) => console.log('part: ', originalName));
uploads.on('deleted', ({ originalName }) => console.log('deleted: ', originalName));
uploads.on('completed', file => console.log('completed: ', file));
uploads.on('updated', file => console.log(' metadata updated: ', file));

const server = createServer((req, res) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/files') {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(+PORT, () => console.log('listening on port:', PORT));
