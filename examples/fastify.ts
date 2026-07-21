import { uploadx } from '@uploadx/core';
import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3002;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = Fastify();

const uploadxHandler = uploadx({
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h'
});

app.addContentTypeParser(
  ['application/octet-stream', 'application/json'],
  (request, payload, done) => done(null)
);

// Alternative: intercept before Fastify parses the request body
// app.addHook('onRequest', async (request, reply) => {
//   if (request.url.split('?')[0] === '/files') {
//     reply.hijack();
//     return uploadxHandler(request.raw, reply.raw);
//   }
// });

app.all('/files/:id?', (request, reply) => {
  reply.hijack();
  return uploadxHandler(request.raw, reply.raw);
});

app.get('/', async () => ({ status: 'ok' }));

app.listen({ port: PORT }, () => console.log('Fastify server listening on port:', PORT));
