import express from 'express';
import { GCStorage, Uploadx } from 'node-uploadx';

const PORT = process.env.PORT || 3002;

const app = express();

// Credentials: set GOOGLE_APPLICATION_CREDENTIALS or pass keyFile option
const storage = new GCStorage({
  bucket: 'my-bucket',
  maxFileSize: '5GB',
  onComplete: ({ uri = 'unknown', id }) => {
    console.log(`File upload complete, storage path: ${uri}`);
    // send gcs link to client
    return { id, link: uri };
  }
});

const uploadx = new Uploadx({ storage });

uploadx.on('error', console.error);
uploadx.on('created', console.info);

app.use('/files', uploadx.handle);

app.listen(PORT, () => console.log('listening on port:', PORT));
