import * as express from 'express';
import { uploadx } from '../src';
import { auth } from './auth';
import { errorHandler } from './error-handler';

import cors = require('cors');
import bodyParser = require('body-parser');
import { Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import debug = require('debug');
const log = debug('uploadx:server');
// ----------------------------------  CONFIG  ---------------------------------

const PORT = 3003;
const maxUploadSize = '180MB';
const destination = join(tmpdir(), 'uploads');
const maxChunkSize = '20MB';
const allowMIME = ['video/*'];

// ----------------------------  CONFIGURE EXPRESS  ----------------------------
const app: express.Application = express();
app.enable('trust proxy');
const corsOptions: cors.CorsOptions = {
  exposedHeaders: ['Range', 'Location']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

app.use(auth);

// ------------ upload route ------------
app.use(
  '/upload/v1/',
  uploadx({
    destination,
    maxUploadSize,
    allowMIME,
    maxChunkSize
  }),
  (req: express.Request, res: express.Response, next) => {
    if (req.file) {
      res.json(req.file);
    } else {
      res.send('next');
    }
  }
);
app.use(
  '/upload/v2/',
  uploadx({
    destination: req => join(tmpdir(), req.user.name, req.body.name)
  }),
  (req: express.Request, res: express.Response) => {
    if (req.file) {
      res.json(req.file);
    } else {
      res.send('next');
    }
  }
);
app.use(
  '/upload/',
  uploadx({
    maxUploadSize,
    allowMIME,
    destination: req => `${tmpdir()}/ngx/${req.body.name}`
  }),
  (req: express.Request, res: express.Response, next) => {
    if (req.file) {
      res.json(req.file);
    } else {
      res.send('next');
    }
  }
);
// ------------------------------  ERROR HANDLER  ------------------------------
app.use(errorHandler);

export const server: Server = app.listen(PORT, 'localhost', () => {
  log('listening on port:', server.address()['port']);
});
