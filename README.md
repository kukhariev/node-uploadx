# node-uploadx

> Express middleware for handling resumable uploads

<!-- [![npm version][npm-image]][npm-url] -->
[![Build status][travis-image]][travis-url]



## Install

```sh
npm install --save node-uploadx
```

## Usage

```js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { uploadx } = require('node-uploadx');
const { auth } = require('./auth');
const { errorHandler } = require('./error-handler');

const app = express();
app.enable('trust proxy');
const corsOptions = {
  exposedHeaders: ['Range', 'Location']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use(auth);

app.use(
  '/upload/',
  uploadx({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: item => `/tmp/${item.metadata.name}`
  }),
  (req, res) => {
    if (req.file) {
      console.log(req.file);
      /*
      { metadata: { name: 'title.mp4', mimeType: 'video/mp4' },
        mimetype: 'video/mp4',
        size: 83869253,
        user: { id: 'userId' },
        id: '250886f74c5a1596ed42e43d4ced526d',
        path: '/tmp/title.mp4',
        filename: 'title.mp4',
        _destination: '/tmp',
        bytesWritten: 83869253,
        created: 2018-05-24T19:26:56.121Z }
      */
      res.json(req.file.metadata);
    } else {
      res.send();
    }
  }
);

app.use(errorHandler);

app.listen(3003);
```

## License

[MIT](LICENSE)

[npm-image]: https://img.shields.io/npm/v/node-uploadx.svg
[npm-url]: https://www.npmjs.com/package/node-uploadx
[travis-image]: https://img.shields.io/travis/kukhariev/node-uploadx/master.svg
[travis-url]: https://travis-ci.org/kukhariev/node-uploadx
