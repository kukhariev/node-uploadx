process.env.DEBUG = 'uploadx:*';
import * as express from 'express';
import { auth } from './auth';
import { errorHandler } from './error-handler';
import { multipart, uploadx, File } from '../../src';

const app = express();
app.use(express.json());
app.use(auth);

// Uploadx.RESUME_STATUS_CODE = 208;

app.use(
  '/upload/videos',
  uploadx({
    maxUploadSize: '15GB',
    allowMIME: ['video/*'],
    expire: 7,
    destination: (req, file) => `./upload/${file.userId}/videos/${file.filename}`
  })
);
app.use(
  '/upload/images',
  multipart({
    maxUploadSize: '25MB',
    allowMIME: ['image/*'],
    expire: 7,
    destination: (req, file) => `./upload/${file.userId}/images/${file.filename}`
  })
);
app.use(errorHandler);

app.get('/upload/*', (req, res) => {
  const files: File[] = req.body;
  if (req.query.upload_id && files.length === 1) {
    const [file] = files;
    res.download(file.path);
  } else {
    const links = files
      .map(file => `<a href=?upload_id=${file.id}>${file.filename}</a>`)
      .join('<br />');
    res.send(`<html><p>${links}</p></html>`);
  }
});

app.listen(3003, error => {
  if (error) {
    return console.error('something bad happened', error);
  }
  console.log('listening on port:', 3003);
});
