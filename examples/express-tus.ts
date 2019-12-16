import * as express from 'express';
import { tus, File } from '../src';

const app = express();

const onComplete = (file: File) => {
  console.log('File upload complete: ', file);
};
const opts = { onComplete };

app.use('/files', [express.static('files'), tus(opts)]);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
