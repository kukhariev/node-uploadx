import { createServer } from 'http';
import { parse } from 'url';
import { GCSFile, GCStorage, Uploadx } from 'node-uploadx';

const storage = new GCStorage({
  clientDirectUpload: true,
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });
uploads.on<GCSFile>('created', file =>
  console.log('google upload link sent to client: ', file.GCSUploadURI)
);

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
