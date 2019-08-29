import * as express from 'express';
import { uploadx } from '../../dist';
import { auth } from './auth';
import { errorHandler } from './error-handler';
const tmpdir = require('os').tmpdir();
const app = express();
app.use(express.json());
app.use(auth);

app.use(
  '/upload/',
  uploadx({
    maxUploadSize: '180MB',
    allowMIME: ['video/*'],
    destination: tmpdir
  }),
  (req, res) => {
    console.log(`file upload completed:\n`, req.body);
    res.json(req.body);
  }
);

app.use(errorHandler);

app.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
