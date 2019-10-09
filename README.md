# node-uploadx

> Middleware for handling resumable uploads.
> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]

## Install

```sh
npm install node-uploadx
```

## Examples

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
    expire: 7,
    destination: req => `/tmp/${req.user.id}/${req.body.name}`
  }),
  // optional `GET` handler
  (req, res) => {
      console.log(req.body);
      res.json(req.body);
    }
  }
);

app.use(errorHandler);
app.listen(3003);
```

### Express (tus)

```js
const express = require('express');;
const { tus } = require('node-uploadx');
const { auth } = require('./auth');
const { errorHandler } = require('./error-handler');

const app = express();
app.use(express.json());

app.use(auth);

app.use(
  '/upload/',
  tus({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: (req, file) => `/tmp/${file.userId || '__anonymous'}/${file.id}`
  }),
  // optional `GET` handler
  (req, res) => {
      console.log(req.body);
      res.json(req.body);
    }
  }
);

app.use(errorHandler);
app.listen(3003);
```

### Node http.Server

```js
const { Uploadx, DiskStorage } = require('../../dist');
const http = require('http');
const url = require('url');
const { tmpdir } = require('os');

const storage = new DiskStorage({ dest: './files' });
const uploads = new Uploadx({ storage });
uploads.on('error', console.error);
uploads.on('created', console.log);
uploads.on('completed', console.log);
uploads.on('deleted', console.log);
uploads.on('part', console.log);

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

## Options

| Name                            | Description                                     |
| ------------------------------- | ----------------------------------------------- |
| **[destination]** \| **[dest]** | _Upload directory or function to set file path_ |
| **[allowMIME]**                 | _Array of allowed MIME types_                   |
| **[maxUploadSize]**             | _Limit allowed file size_                       |
| **[useRelativeURL]**            | _Generate relative upload link_                 |
| **[expire]**                    | _Expiry incomplete in days_                     |

## HTTP API

- [overview](proto.md)

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
