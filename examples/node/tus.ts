import * as http from 'http';
import * as url from 'url';
import { DiskStorage, Tus } from '../../src';

function auth(req: http.IncomingMessage): void {
  (req as any).user = { id: 'c73da16e-96d8-5733-9e23-347b4bf87d12' };
}
const storage = new DiskStorage({
  directory: 'upload',
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*'],
  path: '/upload'
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
  const { pathname } = url.parse(req.url || '');
  auth(req);
  if (/^\/upload(\/.*|$)/.test(pathname || '')) {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, () => console.log('listening on port:', 3003));
