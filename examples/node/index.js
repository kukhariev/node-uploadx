// @ts-check

const { Uploadx, DiskStorage } = require('../../dist');
const http = require('http');
const url = require('url');

const storage = new DiskStorage({
  dest: './upload',
  maxUploadSize: '5GB',
  allowMIME: ['video/*']
});
const uploads = new Uploadx({ storage });
uploads.on('error', error => console.error('error: ', error));
uploads.on('completed', ({ path }) => console.log('completed: ', path));
uploads.on('created', ({ path }) => console.log('created: ', path));
uploads.on('deleted', ({ path }) => console.log('canceled: ', path));

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url);
  if (pathname === '/upload') {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', server.address()['port']);
});
