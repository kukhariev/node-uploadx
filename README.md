# node-uploadx

[![npm version][npm-image]][npm-url] [![Build status][gha-image]][gha-url]
[![commits since latest release][comm-image]][comm-url]

Resumable upload middleware for [express](https://github.com/expressjs/express)
and plain node.js.
Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

## ✨ Features

- resumable simple/chunked uploads
- can save files to local filesystem, S3, GCS
- saving added metadata along with files
- logging and error handling
- chunks checksum verification
- file type/size/custom validations
- fixed/rolling expiration and cleanup
- extensibility (custom storages, upload protocols, etc)

## 🌩️ Installation Options

```sh
# Core only (local storage)
npm install @uploadx/core

# Add cloud storage support
npm install @uploadx/s3    # AWS S3, MinIO, etc.
npm install @uploadx/gcs   # Google Cloud Storage

# Or get everything in one package
npm install node-uploadx
```

## ♨️ Usage

Express example:

```js
const express = require('express');
const { uploadx } = require('@uploadx/core');

const app = express();

app.use(
  '/uploads',
  uploadx({
    directory: './files',
    maxUploadSize: '10GB',
    allowMIME: ['video/*'],
    onComplete: file => console.log('Upload complete: ', file)
  })
);

app.listen(3003);
```

Please navigate to the [examples](examples) for more.

## 🛠️ Options

The `uploadx` function accepts either a storage instance or storage options:

```ts
import { uploadx, DiskStorage } from '@uploadx/core';

// Option 1: Pass storage instance
const storage = new DiskStorage({ directory: './uploads' });
app.use('/files', uploadx(storage));

// Option 2: Pass options directly (creates storage automatically)
app.use('/files', uploadx({ directory: './uploads', maxUploadSize: '10GB' }));
```

### Storage Options

- `directory` DiskStorage upload directory. Default value: `"files"`

- `path` Node http base path. Default value: `"/files"`

- `allowMIME` Allowed MIME types. Default value: `["*/*"]`

- `maxUploadSize` File size limit. Default value: `"5TB"`

- `metaStorage` Provide custom meta storage

- `metaStorageConfig` Configure metafiles storage

- `maxMetadataSize` Metadata size limit. Default value: `"4MB"`

- `validation` Upload validation options

- `useRelativeLocation` Use relative urls. Default value: `false`

- `filename` File naming function

- `userIdentifier` Get user identity

- `onCreate` Callback that is called when a new upload is created

- `onUpdate` Callback that is called when an upload is updated

- `onComplete` Callback that is called when an upload is completed

- `onDelete` Callback that is called when an upload is cancelled

- `onError` Customize error response

- `expiration` Configuring the cleanup of abandoned and completed uploads

- `logLevel` Set built-in logger severity level. Default value: `"none"`

## ☁️ Storage providers

By default, `uploadx` uses DiskStorage (local filesystem) — just set the `directory` option. For cloud or S3‑compatible storage, install the corresponding package and pass a `storage` instance to the middleware.

| Provider             | Package                                    | Description                             |
| -------------------- | ------------------------------------------ | --------------------------------------- |
| Local filesystem     | [`@uploadx/core`](packages/core/README.md) | Built-in. Saves files to `directory`.   |
| AWS S3 / compatible  | [`@uploadx/s3`](packages/s3/README.md)     | Amazon S3, Backblaze B2 S3, MinIO, etc. |
| Google Cloud Storage | [`@uploadx/gcs`](packages/gcs/README.md)   | GCS buckets.                            |

For configuration, authentication, and usage examples, see the respective package READMEs linked above.

## 📝 Logging

The library uses [`@logtape/logtape`](https://logtape.org/) for structured logging. Set `logLevel` to enable it, or configure LogTape directly for advanced use cases.

See [express-logtape.ts](examples/express-logtape.ts) for a complete example.

## 🔑 Environment Variables

`UPLOADX_SECRET` - Secret for salting file/user IDs (set to random string in production).

## Contributing

If you'd like to contribute, please fork the repository and make changes as you'd like.
Pull requests are welcome!

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-uploadx.svg
[npm-url]: https://www.npmjs.com/package/node-uploadx
[gha-image]: https://github.com/kukhariev/node-uploadx/actions/workflows/test.yml/badge.svg
[gha-url]: https://github.com/kukhariev/node-uploadx/actions/workflows/test.yml
[comm-image]: https://img.shields.io/github/commits-since/kukhariev/node-uploadx/latest
[comm-url]: https://github.com/kukhariev/node-uploadx/releases/latest
