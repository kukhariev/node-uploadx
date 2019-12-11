import * as express from 'express';
import { multipart, uploadx } from '../src';

const app = express();

app.use('/files', express.static('files'));

app.use('/files', multipart());

app.use('/upload/files', uploadx());

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
