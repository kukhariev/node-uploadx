import * as express from 'express';
import { multipart, uploadx } from '../src';

const app = express();

app.use(express.json());

app.use('/files', express.static('files'));

app.use('/files', multipart({ directory: 'files' }));

app.use('/upload/files', uploadx({ directory: 'files' }));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
