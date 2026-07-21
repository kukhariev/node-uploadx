# Examples

This directory contains working Express/plain Node.js examples demonstrating various use cases of `node-uploadx`.

## Running Examples

From the repository root, install dependencies first:

```bash
npm install
```

Then navigate to the examples directory and run the desired script:

```bash
# Basic Express example
npm run basic

# Express with default storage (local filesystem)
npm run express

# Express with S3 storage
npm run s3

# Express with GCS storage
npm run gcs

# Plain Node.js server combining Uploadx, TUS and Multipart protocols
npm run server

# Plain Node.js HTTP server example
npm run plain-nodejs

# Other examples...
npm run tus
npm run validation
npm run redis
npm run logtape
npm run custom-error-responses
npm run express-polling
```

## Example Descriptions

| File                                                     | Description                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------- |
| [`express.ts`](express.ts)                               | Express example with authentication and logging                     |
| [`express-basic.ts`](express-basic.ts)                   | Minimal Express setup with local file storage                       |
| [`express-s3.ts`](express-s3.ts)                         | Upload to AWS S3                                                    |
| [`express-gcs.ts`](express-gcs.ts)                       | Upload to Google Cloud Storage                                      |
| [`express-tus.ts`](express-tus.ts)                       | Using the tus resumable upload protocol                             |
| [`express-polling.ts`](express-polling.ts)               | Polling-based upload implementation                                 |
| [`express-redis.ts`](express-redis.ts)                   | Using Redis for metadata storage                                    |
| [`express-logtape.ts`](express-logtape.ts)               | Logging with LogTape                                                |
| [`custom-error-responses.ts`](custom-error-responses.ts) | Custom error handling and responses                                 |
| [`validation.ts`](validation.ts)                         | File validation (type, size, custom rules)                          |
| [`s3-direct.ts`](s3-direct.ts)                           | Direct S3 upload                                                    |
| [`gcs-direct.ts`](gcs-direct.ts)                         | Direct GCS upload                                                   |
| [`node-http-server.js`](node-http-server.js)             | Plain Node.js HTTP server example                                   |
| [`server.js`](server.js)                                 | Plain Node.js server combining Uploadx, TUS and Multipart protocols |
| [Koa examples](#koa)                                     | Koa integration (snippet only, requires separate installation)      |
| [Fastify examples](#fastify)                             | Fastify integration (snippet only, requires separate installation)  |

## Other Frameworks

> ⚠️ Requires `koa` or `fastify` installed separately in your project.

### Koa

#### Basic Koa server

```ts
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
  }
  return next();
});

app.listen(PORT, () => console.log('Koa server listening on port:', PORT));
```

#### Koa with TUS protocol

```ts
import { tus, UploadxFile } from '@uploadx/core';
import Koa from 'koa';

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
```

#### Koa with Node HTTP server

```ts
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
```

### Fastify

#### Basic Fastify server

```ts
import { uploadx } from '@uploadx/core';
import Fastify from 'fastify';

const PORT = Number(process.env.PORT) || 3002;
const UPLOAD_DIR = process.env.UPLOAD_DIR || 'upload';

const app = Fastify();

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
  return uploadx({ uploadDir: UPLOAD_DIR, maxFileSize: '5GB', expiration: '1h' })(
    request.raw,
    reply.raw
  );
});

app.get('/', async () => ({ status: 'ok' }));
app.listen({ port: PORT }, () => console.log('Fastify server listening on port:', PORT));
```

#### Fastify with TUS protocol

```ts
import { tus, UploadxFile } from '@uploadx/core';
import Fastify from 'fastify';

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

app.all('/files/:id?', (request, reply) => {
  reply.hijack();
  return tusHandler(request.raw, reply.raw);
});

app.listen({ port: PORT }, () => console.log('Fastify TUS server listening on port:', PORT));
```

## Prerequisites

Most examples require environment variables. Copy `.env.example` to `.env` and fill in the values:

```env
# Required for all examples
UPLOAD_DIR=./files

# For S3 examples (aws s3, minio, etc.)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
S3_BUCKET=your-bucket

# For GCS examples
GCS_BUCKET=your-bucket
GCS_KEY_FILE=/path/to/key.json

# Optional
UPLOADX_SECRET=your-secret-key
```

See `.env.example` for full environment variable reference.
