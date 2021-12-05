/* eslint-disable no-console */
import * as express from 'express';
import { userId } from './config';
import { IncomingMessage } from 'http';

type Authorized<T> = T & { user?: any };

const app = express();
const authRequest = <T extends IncomingMessage>(req = {} as Authorized<T>): Authorized<T> => {
  req['user'] = { id: userId };
  return req;
};

app.use((req: Authorized<express.Request>, res, next) => {
  authRequest(req);
  next();
});

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});

app.on('error', err => console.error(err));

process.on('uncaughtException', err => console.error(err));

export { app, authRequest };
