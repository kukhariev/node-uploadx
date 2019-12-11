import * as express from 'express';
import { tus } from '../src';

const app = express();

app.use('/files', [express.static('files'), tus()]);

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
