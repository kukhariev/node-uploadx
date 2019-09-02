import * as express from 'express';
import { uploadx, File } from '../../dist';
import { auth } from './auth';
import { errorHandler } from './error-handler';

const app = express();
app.use(express.json());
app.use(auth);

const mime = (file: File): string => file.mimeType.split('/')[0];

app.use(
  '/upload',
  uploadx({
    maxUploadSize: '5GB',
    allowMIME: ['video/*', 'image/*'],
    destination: (req, file) => `./upload/${file.userId}/${mime(file)}/${file.filename}`
  }),
  (req, res) => {
    console.log(`file upload completed:\n`, req.body);
    res.json(req.body);
  }
);

app.use(errorHandler);

app.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
