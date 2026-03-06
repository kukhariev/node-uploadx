/* eslint-disable no-console */
import express from 'express';
import { userId } from './config';
import { IncomingMessage } from 'http';

type Authorized<T> = T & { user?: any };

const authRequest = <T extends IncomingMessage>(req = {} as Authorized<T>): Authorized<T> => {
  req['user'] = { id: userId };
  return req;
};

const app = express();

app.use((req: Authorized<express.Request>, res, next) => {
  authRequest(req);
  next();
});

process.on('uncaughtException', console.error);

export { app, authRequest };
