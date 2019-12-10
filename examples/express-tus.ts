import * as express from 'express';
import { tus } from '../src';

const app = express();

app.use('/files', [express.static('files'), tus({ directory: 'files' })]);

app.listen(3003, error => {
  if (error) return console.error('something bad happened', error);
  console.log('listening on port:', 3003);
});
