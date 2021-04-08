import * as express from 'express';
import { multipart, uploadx } from '@uploadx/core';

const app = express();

app.use('/files', express.static('files'));

app.use('/files', multipart(), (req, res) => {
  res.json({ ...req.body, uploadType: 'multipart' });
});
app.use('/upload/files', uploadx(), (req, res) => {
  res.json({ ...req.body, uploadType: 'uploadx' });
});

app.listen(3003, () => {
  console.log('listening on port:', 3003);
});
