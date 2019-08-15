import * as express from 'express';
export const auth: express.Handler = (req, res, next) => {
  (req as any).user = { id: 'userId' };
  next();
};
