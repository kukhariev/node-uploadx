process.env.DEBUG = 'uploadx:*';
import * as http from 'http';
import * as url from 'url';
import { S3Storage, Uploadx, Multipart, Tus } from '../../src';

const storage = new S3Storage({
  maxUploadSize: '5GB',
  allowMIME: ['video/*', 'image/*'],
  expire: 1
});

const upx = new Uploadx({ storage });
const mpt = new Multipart({ storage });
const tus = new Tus({ storage });
upx.on('error', error => console.error('error: ', error));
mpt.on('error', error => console.error('error: ', error));
tus.on('error', error => console.error('error: ', error));

const server = http.createServer((req, res) => {
  const { pathname, query = {} } = url.parse(req.url || '', true);
  if (pathname.startsWith('/upload')) {
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

server.listen(3003, (error?: any) => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
