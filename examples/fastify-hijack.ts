import { uploadx } from '@uploadx/core';
import Fastify from 'fastify';

const PORT = process.env.PORT || 3002;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = Fastify();

const uploadxHandler = uploadx({
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h'
});

app.addHook('onRequest', async (request, reply) => {
  const path = request.url.split('?')[0];
  if (path === '/files' || path.startsWith('/files/')) {
    reply.hijack();
    return uploadxHandler(request.raw, reply.raw);
  }
});

app.listen({ port: +PORT }, () => console.log('listening on port:', PORT));
