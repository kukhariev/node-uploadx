# node-uploadx

[![npm version][npm-image]][npm-url] [![Build status][travis-image]][travis-url]

> Node.js resumable upload middleware.
> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

## Install

```sh
npm install node-uploadx
```

## Usage

Express example:

```js
const express = require('express');
const { uploadx } = require('node-uploadx');

const app = express();

app.use(express.json());

app.use('/upload/', uploadx({ directory: './files' }));

app.listen(3003);
```

Node http.Server example:

```js
const { Uploadx, DiskStorage } = require('node-uploadx');
const http = require('http');
const url = require('url');

const storage = new DiskStorage({ directory: './files' });
const uploads = new Uploadx({ storage });

const server = http
  .createServer((req, res) => {
    const pathname = url.parse(req.url).pathname.toLowerCase();
    if (pathname === '/upload') {
      uploads.handle(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plan' });
      res.end('Not Found');
    }
  })
  .listen(3003);
```

Please navigate to the [examples](examples) for more advanced examples

### Options

Available options are:

| option           |       type       | default value | description                          |
| :--------------- | :--------------: | :-----------: | ------------------------------------ |
| `directory`      |     `string`     |  `"upload"`   | _Upload directory_                   |
| `allowMIME`      |    `string[]`    |   `["*\*"]`   | _Array of allowed MIME types_        |
| `maxUploadSize`  | `string\|number` |       -       | _Limit allowed file size_            |
| `expire`         |     `number`     |       -       | _Days to discard incomplete uploads_ |
| `useRelativeURL` |    `boolean`     |    `false`    | _Generate relative upload link_      |

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
