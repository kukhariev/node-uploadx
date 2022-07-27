# node-uploadx

[![npm version][npm-image]][npm-url] [![Build status][gha-image]][gha-url]
[![commits since latest release][comm-image]][comm-url]

> Node.js resumable upload middleware.
> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)
> Also supports [tus 1.0](https://github.com/tus/tus-resumable-upload-protocol/blob/master/protocol.md), multipart uploads.

## 🌩 Installation

All-In-One with cloud storage support:

```sh
npm install node-uploadx
```

Separate modules can also be used to save disk space and for faster installation process.:

- core module:

  ```sh
  npm install @uploadx/core
  ```

- _S3_ storage support:

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

Please navigate to the [examples](examples) for more.

### 🛠 Options

Some available options: :

| option                |           type           |  default value   | description                                                  |
| :-------------------- | :----------------------: | :--------------: | ------------------------------------------------------------ |
| `directory`           |         `string`         |    `"files"`     | _DiskStorage upload directory_                               |
| `bucket`              |         `string`         | `"node-uploadx"` | _Storage bucket_                                             |
| `path`                |         `string`         |    `"/files"`    | _Node http base path_                                        |
| `allowMIME`           |        `string[]`        |    `["*\*"]`     | _Allowed MIME types_                                         |
| `maxUploadSize`       |     `string\|number`     |     `"5TB"`      | _File size limit_                                            |
| `metaStorage`         |      `MetaStorage`       |                  | _Provide custom meta storage_                                |
| `metaStorageConfig`   |   `MetaStorageOptions`   |                  | _Configure metafiles storage_                                |
| `maxMetadataSize`     |     `string\|number`     |     `"4MB"`      | _Metadata size limit_                                        |
| `validation`          |       `Validation`       |                  | _Upload validation options_                                  |
| `useRelativeLocation` |        `boolean`         |     `false`      | _Use relative urls_                                          |
| `filename`            |        `Function`        |                  | _File naming function_                                       |
| `userIdentifier`      |     `UserIdentifier`     |                  | _Get user identity_                                          |
| `onComplete`          |       `OnComplete`       |                  | _On upload complete callback_                                |
| `expiration`          |   `ExpirationOptions`    |                  | _Configuring the cleanup of abandoned and completed uploads_ |
| `checksum`            | `boolean\|"md5"\|"sha1"` |                  | _Enable/disable file/range checksum calculation_             |

## Contributing

If you'd like to contribute, please fork the repository and make changes as you'd like.
Pull requests are welcome!

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-uploadx.svg
[npm-url]: https://www.npmjs.com/package/node-uploadx
[gha-image]: https://github.com/kukhariev/node-uploadx/workflows/CI/badge.svg
[gha-url]: https://github.com/kukhariev/node-uploadx
[comm-image]: https://img.shields.io/github/commits-since/kukhariev/node-uploadx/latest
[comm-url]: https://github.com/kukhariev/node-uploadx/releases/latest
