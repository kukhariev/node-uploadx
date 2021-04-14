import * as express from 'express';
import { GCStorage, uploadx } from 'node-uploadx';

const app = express();

const storage = new GCStorage();

storage.onComplete = ({ uri, id }) => {
  console.log(`File upload complete, storage path: ${uri}`);
  // send gcs link to client
  return { id, link: uri };
};

app.use('/files', uploadx({ storage }));

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
