# node-uploadx

> Middleware for handling resumable uploads.

> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]

## Install

```sh
npm install node-uploadx
```

## Example

### Express

```js
const express = require('express');;
const { uploadx } = require('node-uploadx');
const { auth } = require('./auth');
const { errorHandler } = require('./error-handler');

const app = express();
app.use(express.json());

app.use(auth);

app.use(
  '/upload/',
  uploadx({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: req => `/tmp/${req.user.id}/${req.body.name}`
  }),
  (req, res) => {
      console.log(req.file);
      res.json(req.file.metadata);
    }
  }
);

app.use(errorHandler);
app.listen(3003);
```

### Node

```js
const { Uploadx, DiskStorage } = require('../../dist');
const http = require('http');
const url = require('url');
const { tmpdir } = require('os');

const storage = new DiskStorage({ dest: (req, file) => `${tmpdir()}/ngx/${file.filename}` });
const uploads = new Uploadx({ storage });
uploads.on('error', console.error);
uploads.on('created', console.log);
uploads.on('complete', console.log);
uploads.on('deleted', console.log);

const server = http.createServer((req, res) => {
  const pathname = url.parse(req.url).pathname.toLowerCase();
  if (pathname === '/upload') {
    uploads.handle(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plan' });
    res.end('Not Found');
  }
});

server.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', server.address()['port']);
});
```

## API

### Options

| Name                 | Description                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **[destination]**    | _Upload directory or function to set file path_                                                              |
| **[allowMIME]**      | _Array of allowed MIME types_                                                                                |
| **[maxUploadSize]**  | _Limit file size_                                                                                            |
| **[maxChunkSize]**   | _Sets the maximum allowed chunk size. \*The default value for nginx client_max_body_size directive is 1 MiB_ |
| **[useRelativeURL]** | _Generate relative upload link_                                                                              |

### Requests

| Method     | Action                         |
| ---------- | ------------------------------ |
| **POST**   | _Create upload session_        |
| **PUT**    | _Save file_                    |
| **GET**    | _List not finished session(s)_ |
| **DELETE** | _Remove session_               |

## Contributing

If you'd like to contribute, please fork the repository and make changes as you'd like.
Pull requests are welcome!

## References

- [https://developers.google.com/drive/v3/web/resumable-upload](https://developers.google.com/drive/v3/web/resumable-upload)

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-uploadx.svg
[npm-url]: https://www.npmjs.com/package/node-uploadx
[travis-image]: https://img.shields.io/travis/kukhariev/node-uploadx/master.svg
[travis-url]: https://travis-ci.org/kukhariev/node-uploadx
