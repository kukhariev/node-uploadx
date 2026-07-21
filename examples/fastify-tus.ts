import { tus, UploadxFile } from '@uploadx/core';
import Fastify from 'fastify';

declare module 'http' {
  interface IncomingMessage {
    user?: { id: string; email: string };
  }
}

const PORT = Number(process.env.PORT) || 3002;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = Fastify();

app.addContentTypeParser('application/offset+octet-stream', (request, payload, done) => done(null));

const tusHandler = tus({
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h',
  onComplete: (file: UploadxFile) => {
    console.log('Upload complete:', file.name);
    return file;
  }
});

app.all(`/files/:id?`, (request, reply) => {
  request.raw.user = { id: '92be348f', email: 'user@example.com' };
  reply.hijack();
  return tusHandler(request.raw, reply.raw);
});

app.get('/', async () => ({ status: 'ok' }));

app.listen({ port: PORT }, () => console.log('Fastify TUS server listening on port:', PORT));
