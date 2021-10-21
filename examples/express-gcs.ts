import * as express from 'express';
import { GCStorage, Uploadx } from 'node-uploadx';

const app = express();

const storage = new GCStorage({ maxUploadSize: '1GB' });
const uploadx = new Uploadx({ storage });

uploadx.on('error', err => console.error(err));
uploadx.on('created', file => console.info(file));

storage.onComplete = ({ uri, id }) => {
  console.log(`File upload complete, storage path: ${uri}`);
  // send gcs link to client
  return { id, link: uri };
};

app.use('/files', uploadx.handle);

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
