import * as express from 'express';
export const errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  res.status(err.status || err.statusCode || 500).json({
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
};
