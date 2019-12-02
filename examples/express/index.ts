process.env.DEBUG = 'uploadx:*';
import * as express from 'express';
import { multipart, uploadx } from '../../src';

const authMiddleware: express.Handler = (req, res, next) => {
  (req as any).user = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};
const app = express();
app.use(authMiddleware);
app.use(express.json());

// Uploadx.RESUME_STATUS_CODE = 208;

app.use('/upload', express.static('upload'));
app.use(
  '/upload/videos',
  uploadx({
    maxUploadSize: '15GB',
    allowMIME: ['video/*'],
    expire: 7,
    filename: file => `${file.userId}/videos/${file.filename}`
  })
);
app.use(
  '/upload/images',
  multipart({
    maxUploadSize: '25MB',
    allowMIME: ['image/*'],
    expire: 7,
    filename: file => `${file.userId}/images/${file.filename}`
  })
);

app.listen(3003, error => {
  if (error) return console.error('something bad happened', error);
  console.log('listening on port:', 3003);
});
