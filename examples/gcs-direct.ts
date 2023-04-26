import { cors, MetaStorage, Uploadx } from '@uploadx/core';
import { GCStorage } from '@uploadx/gcs';
import { createServer } from 'http';
import { parse } from 'url';

const PORT = process.env.PORT || 3002;

const corsHandler = cors();

// Don't forget to set GCS_BUCKET and GCS_KEYFILE environment variables
const storage = new GCStorage({
  clientDirectUpload: true,
  maxUploadSize: '15GB',
  allowMIME: ['video/*', 'image/*'],
  filename: file => file.originalName,
  metaStorage: new MetaStorage()
});

const uploadx = new Uploadx({ storage });
uploadx.on('created', file =>
  console.log('google upload link sent to client: ', file.GCSUploadURI)
);

createServer((req, res) => {
  const { pathname } = parse(req.url || '');
  if (pathname === '/files') {
    uploadx.handle(req, res);
  } else {
    corsHandler(req, res, () => uploadx.send(res, { body: 'Not Found', statusCode: 404 }));
  }
}).listen(PORT, () => console.log('listening on port:', PORT));
