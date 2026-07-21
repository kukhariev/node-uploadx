import { uploadx } from '@uploadx/core';
import Koa from 'koa';

const PORT = process.env.PORT || 3003;
const BASE_PATH = process.env.BASE_PATH || '/files';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = new Koa();

const uploadxHandler = uploadx({
  basePath: BASE_PATH,
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h'
});

app.use((ctx, next) => {
  if (ctx.path.startsWith(BASE_PATH)) {
    ctx.respond = false;
    return uploadxHandler(ctx.req, ctx.res);
  } else {
    return next();
  }
});

app.listen(PORT, () => console.log('Koa server listening on port:', PORT));
