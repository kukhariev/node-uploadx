import { tus, UploadxFile } from '@uploadx/core';
import Koa from 'koa';

declare module 'koa' {
  interface DefaultState {
    user: { id: string; email: string };
  }
}

declare module 'http' {
  interface IncomingMessage {
    user?: { id: string; email: string };
  }
}

const PORT = process.env.PORT || 3003;
const BASE_PATH = process.env.BASE_PATH || '/files';
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = new Koa();

const tusHandler = tus({
  basePath: BASE_PATH,
  uploadDir: UPLOAD_DIR,
  maxFileSize: '5GB',
  expiration: '1h',
  onComplete: (file: UploadxFile) => {
    console.log('Upload complete:', file.name);
    return file;
  }
});

app.use(async (ctx, next) => {
  // production: ctx.state.user is already populated by koa-jwt / passport / session
  ctx.state.user = { id: '92be348f', email: 'user@example.com' };
  await next();
});

app.use((ctx, next) => {
  if (ctx.path.startsWith(BASE_PATH)) {
    ctx.req.user = ctx.state.user;
    ctx.respond = false;
    return tusHandler(ctx.req, ctx.res);
  }
  return next();
});

app.listen(PORT, () => console.log('Koa TUS server listening on port:', PORT));
