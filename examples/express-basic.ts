import * as express from 'express';
import { multipart, uploadx } from '../src';

const app = express();
const onComplete = file => {
  console.log('File upload complete: ', file);
};
const opts = { onComplete };

app.use('/files', express.static('files'));

app.use('/files', multipart(opts));

app.use('/upload/files', uploadx(opts));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
