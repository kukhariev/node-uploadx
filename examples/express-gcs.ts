import * as express from 'express';
import { GCStorage, uploadx } from 'node-uploadx';

const app = express();

const storage = new GCStorage();

storage.onComplete = file => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (file as any)['custom'] = 'Hi!';
  console.log('File upload complete: ', file);
};

app.use('/files', uploadx({ storage }));

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
