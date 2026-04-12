import { uploadx, getLogger } from '@uploadx/core';
import express from 'express';

type AuthRequest = express.Request & { user?: { id: string; email: string } };

const PORT = process.env.PORT || 3002;

const app = express();

const appLogger = getLogger(['uploadx', 'server']);

const auth = (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  req.user = { id: '92be348f', email: 'user@example.com' };
  next();
};

app.use(auth);

const onComplete: express.RequestHandler = (req, res, next) => {
  return res.json(req.body);
};

app.use(
  '/files',
  uploadx.upload({
    maxUploadSize: '1GB',
    directory: process.env.UPLOAD_DIR || 'upload',
    expiration: { maxAge: '1h', purgeInterval: '10min' },
    userIdentifier: (req: AuthRequest) => (req.user ? `${req.user.id}-${req.user.email}` : ''),
    logLevel: 'debug',
    onComplete: file => {
      appLogger.info(`File upload complete: ${file.name}`);
      return file;
    }
  }),
  onComplete
);

app.listen(PORT, () => appLogger.info('listening on port: {PORT}', { PORT }));
