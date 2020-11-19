# node-uploadx

[![npm version][npm-image]][npm-url] [![Travis status][travis-image]][travis-url] [![Build status][gha-image]][gha-url]

> Node.js resumable upload middleware.
> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

## 🌩 Installation

All-In-One:

```sh
npm install node-uploadx
```

Separate modules can also be used to save disk space and for faster installation process.:

- core module:

  ```sh
  npm install @uploadx/core
  ```

- _Google Cloud Storage_ support:

  ```sh
  npm install @uploadx/gcs
  ```

- _AWS S3_ support:

  ```sh
  npm install @uploadx/s3
  ```

## ♨ Usage

Express example:

```js
const express = require('express');
const { uploadx } = require('@uploadx/core');

const app = express();
const opts = {
  directory: './files',
  onComplete: file => console.log('Upload complete: ', file)
};

app.use('/upload/files', uploadx(opts));

app.listen(3003);
```

Node http.Server GCS example:

```js
const { Uploadx, GCStorage } = require('node-uploadx');
const http = require('http');
const url = require('url');

const storage = new GCStorage({ bucket: 'uploads' });
const uploads = new Uploadx({ storage });
uploads.on('completed', console.log);

const server = http
  .createServer((req, res) => {
    const pathname = url.parse(req.url).pathname;
    if (pathname === '/upload/files') {
      uploads.handle(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plan' });
      res.end('Not Found');
    }
  })
  .listen(3003);
```

Please navigate to the [examples](examples) for more.

### 🛠 Options

Available options are:

| option                |       type       |  default value   | description                     |
| :-------------------- | :--------------: | :--------------: | ------------------------------- |
| `directory`           |     `string`     |    `"files"`     | _DiskStorage upload directory_  |
| `bucket`              |     `string`     | `"node-uploadx"` | _S3 or GCS bucket_              |
| `path`                |     `string`     |    `"/files"`    | _Node http base path_           |
| `allowMIME`           |    `string[]`    |    `["*\*"]`     | _Array of allowed MIME types_   |
| `maxUploadSize`       | `string\|number` |     `"50GB"`     | _Limit allowed file size_       |
| `useRelativeLocation` |    `boolean`     |     `false`      | _Generate relative upload link_ |
| `filename`            |    `Function`    |                  | _Filename generator function_   |
| `onComplete`          |    `Function`    |                  | _File upload complete callback_ |

For Google Cloud Storage authenticate see [GoogleAuthOptions](https://github.com/googleapis/google-auth-library-nodejs/blob/04dae9c271f0099025188489c61fd245d482832b/src/auth/googleauth.ts#L62). Also supported `GCS_BUCKET`, `GCS_KEYFILE` and `GOOGLE_APPLICATION_CREDENTIALS` environment variables.

For AWS S3 - [Setting Credentials in Node.js](https://docs.aws.amazon.com/en_us/sdk-for-javascript/v2/developer-guide/setting-credentials-node.html) and `S3_BUCKET`, `S3_KEYFILE` environment variable.

## References

- [https://developers.google.com/drive/api/v3/manage-uploads#resumable](https://developers.google.com/drive/api/v3/manage-uploads#resumable)
- [https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md)

## Contributing

If you'd like to contribute, please fork the repository and make changes as you'd like.
Pull requests are welcome!

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-uploadx.svg
[npm-url]: https://www.npmjs.com/package/node-uploadx
[travis-image]: https://img.shields.io/travis/kukhariev/node-uploadx/master.svg
[travis-url]: https://travis-ci.org/kukhariev/node-uploadx
[gha-image]: https://github.com/kukhariev/node-uploadx/workflows/CI/badge.svg
[gha-url]: https://github.com/kukhariev/node-uploadx
