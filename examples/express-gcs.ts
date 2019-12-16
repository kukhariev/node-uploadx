import * as express from 'express';
import { uploadx, GCStorage } from '../src';

const app = express();

const onComplete = file => {
  console.log('File upload complete: ', file);
};

const storage = new GCStorage({ onComplete });

app.use('/upload/files', uploadx({ storage }));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
