import { File, UploadxResponse } from '@uploadx/core';
import { RequestHandler } from 'express';
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
  namespace Express {
    interface Response {
      finishUpload: (uploadxResponse: UploadxResponse) => this;
    }
  }
}
/**
 *
 * @param busyResponse
 * @param timeout seconds
 */
export const completedRetryGuard: (
  busyResponse: UploadxResponse,
  timeout?: number
) => RequestHandler = (busyResponse, timeout = 100) => {
  const lock: Record<string, UploadxResponse> = {};

  return async (req, res, next) => {
    const { name: filename } = req.body as File;
    function send(response: UploadxResponse) {
      const { statusCode = 200, ...body } = response;
      res.status(statusCode).json(body);
    }
    const done = () =>
      new Promise<UploadxResponse>(resolve => {
        let i = 0;
        (function scan() {
          if (lock[filename].statusCode !== busyResponse.statusCode || i++ > timeout) {
            return resolve(lock[filename]);
          }
          setTimeout(scan, 1000);
        })();
      });

    res.finishUpload = (uploadxResponse: UploadxResponse) => {
      lock[filename] = uploadxResponse;
      return res;
    };

    if (lock[filename]) {
      send(await done());
      return;
    }

    lock[filename] = busyResponse;
    // prevent resend last chunk
    send(busyResponse);
    next();
  };
};
