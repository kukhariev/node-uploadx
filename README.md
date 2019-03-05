# node-uploadx

> Express middleware for handling resumable uploads.

> Server-side part of [ngx-uploadx](https://github.com/kukhariev/ngx-uploadx)

[![npm version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]

## Install

```sh
npm install node-uploadx
```

## Example

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
    destination: req => `/tmp/${req.user.id}/${req.body.name}`
  }),
  (req, res) => {
    if (req.file) {
      console.log(req.file);
      /*
      { metadata: { name: 'title.mp4', mimeType: 'video/mp4' },
        mimetype: 'video/mp4',
        size: 83869253,
        userid: 'b0755e0676120ee',
        id: '250886f74c5a1596ed42e43d4ced526d',
        path: '/tmp/b0755e0676120ee/title.mp4',
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

## API

### Options

| Name                 | Description                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------ |
| **[destination]**    | _Upload directory or functtion to set file path_                                                             |
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
