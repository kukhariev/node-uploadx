import { tus, UploadxFile } from '@uploadx/core';
import Fastify from 'fastify';

const PORT = process.env.PORT || 3002;
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
  return tusHandler(request.raw, reply.raw);
});

app.listen({ port: +PORT }, () => console.log('listening on port:', PORT));
