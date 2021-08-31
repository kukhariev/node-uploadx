import * as express from 'express';
import { DiskFile, uploadx } from 'node-uploadx';
import { join } from 'path';

const app = express();

const onComplete: express.RequestHandler = async (req, res, next) => {
  const file = req.body as DiskFile;
  await file.lock(() => res.status(423).json({ message: 'processing' }));
  const sha1 = await file.hash('sha1');
  await file.move(join('upload', file.originalName));
  await file.lock(() => res.json({ ...file, sha1 }));
  await file.delete();
  return res.json({ ...file, sha1 });
};

app.all(
  '/files',
  uploadx.upload({
    directory: 'upload',
    expiration: { maxAge: '12h', purgeInterval: '1h' }
  }),
  onComplete
);

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
