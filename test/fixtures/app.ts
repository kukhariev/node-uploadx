import * as express from 'express';
import * as rimraf from 'rimraf';
import { BaseStorageOptions } from '../../src';
export const userPrefix = 'userId';

const app = express();
export const root = 'files';
app.use((req, res, next) => {
  (req as any).user = { id: userPrefix };
  next();
});

export const storageOptions: BaseStorageOptions = {
  filename: file => `${file.userId}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*'],
  useRelativeLocation: true
};

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});

app.on('error', err => console.log(err));

process.on('uncaughtException', err => console.log(err));

export const rm = (dir: string): void => rimraf.sync(dir);

export { app };
