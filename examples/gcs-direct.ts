import { MetaStorage, Uploadx } from '@uploadx/core';
import { GCStorage } from '@uploadx/gcs';
import { createServer } from 'http';
import { parse } from 'url';

const PORT = process.env.PORT || 3002;

// Don't forget to set GCS_BUCKET and GCS_KEYFILE environment variables
const storage = new GCStorage({
  clientDirectUpload: true,
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*'],
  filename: file => file.originalName,
  metaStorage: new MetaStorage()
});

const uploads = new Uploadx({ storage });
uploads.on('created', file =>
  console.log('google upload link sent to client: ', file.GCSUploadURI)
);

createServer((req, res) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/files') {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
}).listen(PORT, () => console.log('listening on port:', PORT));
