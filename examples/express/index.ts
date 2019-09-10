import * as express from 'express';
import { uploadx, File, Uploadx } from '../../dist';
import { auth } from './auth';
import { errorHandler } from './error-handler';

const app = express();
app.use(express.json());
app.use(auth);

const mime = (file: File): string => file.mimeType.split('/')[0];

// Uploadx.RESUME_STATUS_CODE = 208;

app.use(
  '/upload',
  uploadx({
    maxUploadSize: '15GB',
    allowMIME: ['video/*', 'image/*'],
    destination: (req, file) => `./upload/${file.userId}/${mime(file)}/${file.filename}`
  })
);
app.use(errorHandler);

app.get('/upload', (req, res) => {
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
