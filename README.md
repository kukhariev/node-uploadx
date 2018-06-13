# uploadx

> Node.js middleware for handling resumable uploads

[![npm version][npm-image]][npm-url]



## Install

```sh
npm install --save uploadx
```

## Usage

```js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { uploadx } = require('../src');
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
  (req, res, next) => {
    if (req.file) {
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

[npm-image]: https://img.shields.io/npm/v/uploadx.svg
[npm-url]: https://www.npmjs.com/package/uploadx
