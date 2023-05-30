import { uploadx } from '@uploadx/core';
import * as express from 'express';
import { createLogger, format, transports } from 'winston';

type AuthRequest = express.Request & { user?: { id: string; email: string } };

const PORT = process.env.PORT || 3002;

const logger = createLogger({
  format: format.combine(format.splat(), format.simple()),
  transports: [new transports.Console()],
  level: process.env.LOG_LEVEL || 'info'
});

const app = express();

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
    directory: process.env.UPLOAD_DIR || 'upload',
    expiration: { maxAge: '1h', purgeInterval: '10min' },
    userIdentifier: (req: AuthRequest) => (req.user ? `${req.user.id}-${req.user.email}` : ''),
    logger,
    onError: ({ statusCode, body }) => {
      const errors = [{ status: statusCode, title: body?.code, detail: body?.message }];
      return {
        statusCode,
        headers: { 'Content-Type': 'application/vnd.api+json' },
        body: { errors }
      };
    }
  }),
  onComplete
);

app.listen(PORT, () => logger.info('listening on port: %d', PORT));
