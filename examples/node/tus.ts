import { Tus, DiskStorage } from '../../src';
import * as http from 'http';
import * as url from 'url';

const storage = new DiskStorage({
  dest: './upload',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});

// remove old uploads
setInterval(() => storage.expiry(60, true), 3_600_000);

const uploads = new Tus({ storage });

uploads.on('error', (error: any) => console.error('error: ', error));
uploads.on('completed', ({ path }) => console.log('completed: ', path));
uploads.on('created', ({ path }) => console.log('created: ', path));
uploads.on('deleted', ({ path }) => console.log('canceled: ', path));
uploads.on('part', ({ path }) => console.log('part: ', path));

const server = http.createServer((req, res) => {
  const { pathname = '' } = url.parse(req.url || '');

  if (/^\/upload(\/.*|$)/.test(pathname)) {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, (error?: any) => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
