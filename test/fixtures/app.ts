/* eslint-disable no-console */
import * as express from 'express';
import { userPrefix } from '.';
interface ExtendedRequest extends express.Request {
  [key: string]: any;
}
const app = express();
app.use((req: ExtendedRequest, res, next) => {
  req['user'] = { id: userPrefix };
  next();
});

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});

app.on('error', err => console.error(err));

process.on('uncaughtException', err => console.error(err));

export { app };
