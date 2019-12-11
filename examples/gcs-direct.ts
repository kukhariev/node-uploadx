import { GCStorage, Uploadx } from '../src';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';

function auth(req: IncomingMessage): void {
  (req as any).user = { id: 'c73da16e-96d8-5733-9e23-347b4bf87d12' };
}
const storage = new GCStorage({
  clientDirectUpload: true,
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*']
});
const uploads = new Uploadx({ storage });
uploads.on('created', file => console.log('created: ', file));

const server = createServer((req, res) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/upload/files') {
    auth(req);
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});
server.listen(3003, () => console.log('listening on port:', 3003));
