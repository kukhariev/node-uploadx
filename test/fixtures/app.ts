import * as express from 'express';
import { userPrefix } from '.';

const app = express();
app.use((req, res, next) => {
  (req as any).user = { id: userPrefix };
  next();
});

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});

app.on('error', err => console.log(err));

process.on('uncaughtException', err => console.log(err));

export { app };
