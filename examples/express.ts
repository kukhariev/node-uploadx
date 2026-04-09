import { uploadx } from '@uploadx/core';
import express from 'express';
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
    onError: (error: unknown) => {
      const isDev = process.env.NODE_ENV === 'development';
      const e = error as Record<string, unknown>;
      const b = (e.body ?? e) as Record<string, unknown>;

      const errorResponse = {
        error: {
          code: b.code || b.uploadxErrorCode || 'InternalError',
          message: b.message || 'An unexpected error occurred',
          ...(isDev && b.cause ? { debug: b.cause } : {})
        }
      };

      return {
        statusCode: Number(e.statusCode) || 500,
        body: errorResponse
      };
    }
  }),
  onComplete
);

app.listen(PORT, () => logger.info('listening on port: %d', PORT));
