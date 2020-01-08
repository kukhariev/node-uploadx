import * as express from 'express';
import * as rimraf from 'rimraf';
import { DiskStorage, Multipart, Tus, Uploadx } from '../../src';
export const userPrefix = 'userId';
export const uploadDir = `files`;

const app = express();

app.use((req, res, next) => {
  (req as any).user = { id: userPrefix };
  next();
});

export const storage = new DiskStorage({
  directory: `${uploadDir}`,
  filename: file => `${file.userId}/${file.originalName}`,
  maxUploadSize: '6GB',
  allowMIME: ['video/*', 'image/*'],
  useRelativeLocation: true
});

const upx = new Uploadx({ storage });
const tus = new Tus({ storage });
const mpt = new Multipart({ storage });

upx.on('completed', () => null);
upx.on('error', () => null);

export const TUS_PATH = '/tus/upload';
export const UPLOADX_PATH = '/upx/upload';
export const MULTIPART_PATH = '/mpt/upload';

app.use(TUS_PATH, tus.handle);
app.use(UPLOADX_PATH, upx.handle);
app.use(MULTIPART_PATH, mpt.handle);

app.get('/*/upload', (req, res) => {
  res.json(req.body);
});

app.on('error', err => console.log(err));

process.on('uncaughtException', err => console.log(err));

export { app };

export * from './testfile';

export const uploadDirCleanup = (): void => rimraf.sync(uploadDir);
