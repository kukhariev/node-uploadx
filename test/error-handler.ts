import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
const errorHandler: ErrorRequestHandler = (
  err,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.status(err.statusCode || 500).json({
    error: {
      code: err.code,
      message: err.message,
      details: err.details
    }
  });
};

export { errorHandler };
