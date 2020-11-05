// @ts-check
const { createServer } = require('http');
const { parse } = require('url');
const { DiskStorage, Uploadx } = require('node-uploadx');

const storage = new DiskStorage({
  directory: 'upload',
  path: '/files',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });

uploads.on('error', error => console.error('error: ', error));
uploads.on('created', ({ name }) => console.log('created: ', name));
uploads.on('part', ({ name }) => console.log('part: ', name));
uploads.on('deleted', ({ name }) => console.log('deleted: ', name));
uploads.on('completed', file => console.log('completed: ', file));

const server = createServer((req, res) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/upload/files') {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, () => console.log('listening on port:', 3003));
