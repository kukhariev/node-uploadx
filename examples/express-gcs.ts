import * as express from 'express';
import { GCStorage, uploadx } from 'node-uploadx';

const app = express();

const storage = new GCStorage();

storage.onComplete = file => {
  file['custom'] = 'Hi!';
  console.log('File upload complete: ', file);
};

app.use('/files', uploadx({ storage }));

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
