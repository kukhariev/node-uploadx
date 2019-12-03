// @ts-check
const http = require('http');
const url = require('url');
const { Uploadx, DiskStorage } = require('../../dist');

const storage = new DiskStorage({
  directory: 'upload',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });
uploads.on('error', error => console.error('error: ', error));
uploads.on('completed', ({ path }) => console.log('completed: ', path));
uploads.on('created', ({ path }) => console.log('created: ', path));
uploads.on('deleted', ({ path }) => console.log('canceled: ', path));

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url || '');
  if (/^\/upload(\/.*|$)/.test(pathname)) {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, () => console.log('listening on port:', 3003));
