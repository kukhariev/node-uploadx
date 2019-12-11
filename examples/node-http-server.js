const { createServer } = require('http');
const { parse } = require('url');
const { DiskStorage, Uploadx } = require('../dist');

const storage = new DiskStorage({
  directory: 'upload',
  path: '/files',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });

uploads.on('error', error => console.error('error: ', error));
uploads.on('created', ({ path }) => console.log('created: ', path));
uploads.on('part', ({ path }) => console.log('part: ', path));
uploads.on('deleted', ({ path }) => console.log('deleted: ', path));
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
