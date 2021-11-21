import { DiskFile, uploadx } from '@uploadx/core';
import * as express from 'express';

const PORT = process.env.PORT || 3002;

const app = express();

const auth: express.Handler = (req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (req as any)['user'] = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};

app.use(auth);

const onComplete: express.RequestHandler = async (req, res, next) => {
  const file = req.body as DiskFile;
  return res.json(file);
};
app.use(
  '/files',
  uploadx.upload({
    directory: 'upload',
    expiration: { maxAge: '1h', purgeInterval: '10min' }
  }),
  onComplete
);

app.listen(PORT, () => console.log('listening on port:', PORT));
