import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import debug = require('debug');
const log = debug('uploadx:errors');
const errorHandler: ErrorRequestHandler = (
  err,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // console.log(err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || err
    }
  });
};

export { errorHandler };
