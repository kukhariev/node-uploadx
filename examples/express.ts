import { getLogger, uploadx, fromEnv } from '@uploadx/core';
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

app.use(
  '/files',
  uploadx.upload({
    maxFileSize: '5GB',
    uploadDir: './upload',
    expiration: '1h',
    userIdentifier: (req: AuthRequest) => (req.user ? `${req.user.id}-${req.user.email}` : ''),
    onComplete: file => {
      appLogger.info(`File upload complete: ${file.name}`);
      return file;
    },
    ...fromEnv()
  }),
  (req, res) => {
    return res.json(req.body);
  }
);

app.listen(PORT, () => appLogger.info('listening on port: {PORT}', { PORT }));
