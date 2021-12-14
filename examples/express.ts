/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { DiskFile, uploadx } from '@uploadx/core';
import * as express from 'express';

const PORT = process.env.PORT || 3002;
type UserInfo = { user?: { id: string; email: string } };

const app = express();

const auth = (
  req: express.Request & UserInfo,
  res: express.Response,
  next: express.NextFunction
) => {
  req.user = { id: '92be348f', email: 'user@example.com' };
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
    expiration: { maxAge: '1h', purgeInterval: '10min' },
    userIdentifier: (req: express.Request & UserInfo) => `${req.user!.id}-${req.user!.email}`
  }),
  onComplete
);

app.listen(PORT, () => console.log('listening on port:', PORT));
