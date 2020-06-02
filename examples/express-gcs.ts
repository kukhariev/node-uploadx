import * as express from 'express';
import { GCStorage, uploadx } from '../src';

const app = express();

const storage = new GCStorage();

storage.onComplete = file => {
  file['custom'] = 'Hi!';
  console.log('File upload complete: ', file);
};

app.use('/files', uploadx({ storage }));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
