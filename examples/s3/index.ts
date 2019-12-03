process.env.DEBUG = 'uploadx:*';
import * as http from 'http';
import * as url from 'url';
import { S3Storage, Uploadx, Multipart, Tus } from '../../src';

function auth(req: http.IncomingMessage): void {
  (req as any).user = { id: 'c73da16e-96d8-5733-9e23-347b4bf87d12' };
}

const storage = new S3Storage({
  maxUploadSize: '5GB',
  allowMIME: ['video/*', 'image/*'],
  path: '/upload'
});

const upx = new Uploadx({ storage });
const mpt = new Multipart({ storage });
const tus = new Tus({ storage });
upx.on('error', error => console.error('error: ', error));
mpt.on('error', error => console.error('error: ', error));
tus.on('error', error => console.error('error: ', error));

const server = http.createServer((req, res) => {
  auth(req);
  const { pathname, query } = url.parse(req.url || '', true);
  auth(req);
  if (/^\/upload(\/.*|$)/.test(pathname || '')) {
    if (query.uploadType === 'multipart') {
      mpt.handle(req, res);
    } else if (query.uploadType === 'tus') {
      tus.handle(req, res);
    } else {
      upx.handle(req, res);
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, () => console.log('listening on port:', 3003));
