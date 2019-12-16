import * as express from 'express';
import { uploadx, GCStorage } from '../src';

const app = express();

const storage = new GCStorage();
storage.onComplete = file => console.log('File upload complete: ', file);
app.use('/upload/files', uploadx({ storage }));

app.listen(3003, error => {
  if (error) throw error;
  console.log('listening on port:', 3003);
});
