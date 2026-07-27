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

app.register(
  async instance => {
    instance.addContentTypeParser(
      ['application/octet-stream', 'application/json'],
      (request, payload, done) => done(null)
    );
    instance.all('*', (request, reply) => {
      return uploadxHandler(request.raw, reply.raw);
    });
  },
  { prefix: '/files' }
);

app.listen({ port: +PORT }, () => console.log('listening on port:', PORT));
