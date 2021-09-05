import * as express from 'express';
import { GCStorage, uploadx } from 'node-uploadx';

const app = express();

const storage = new GCStorage({ maxUploadSize: '1GB' });

storage.onComplete = async file => {
  const info = await file.get().catch(console.error);
  console.log(info);
  return file.move(file.originalName).catch(console.error);
};

app.use('/files', uploadx({ storage }));

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
