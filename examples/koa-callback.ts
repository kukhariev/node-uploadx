import { createServer } from 'http';
import { uploadx, UploadxFile } from '@uploadx/core';
import Koa from 'koa';

const PORT = process.env.PORT || 3003;
const BASE_PATH = process.env.BASE_PATH || '/files';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = new Koa();

app.use(async ctx => {
  ctx.body = { status: 'ok' };
});

const koa = app.callback();

const uploadxHandler = uploadx({
  basePath: BASE_PATH,
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h',
  onComplete: (file: UploadxFile) => {
    console.log('Upload complete:', file.name);
    return file;
  }
});

createServer((req, res) => {
  if (req.url?.startsWith(BASE_PATH)) {
    uploadxHandler(req, res);
  } else {
    void koa(req, res);
  }
}).listen(PORT, () => console.log('Koa + uploadx (callback) server listening on port:', PORT));
