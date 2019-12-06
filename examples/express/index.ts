process.env.DEBUG = 'uploadx:*';
import * as express from 'express';
import { multipart, uploadx, GCStorage, tus, S3Storage } from '../../src';

const auth: express.Handler = (req, res, next) => {
  (req as any).user = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};
const app = express();
app.use(auth);
app.use(express.json());

// Uploadx.RESUME_STATUS_CODE = 208;

app.use('/upload/images', multipart({ storage: new S3Storage({ allowMIME: ['image/*'] }) }));

app.use(
  '/upload/videos',
  uploadx({ storage: new GCStorage({ allowMIME: ['video/*'], clientDirectUpload: true }) })
);

app.use('/upload', tus({ directory: './files' }));

app.listen(3003, error => {
  if (error) return console.error('something bad happened', error);
  console.log('listening on port:', 3003);
});
