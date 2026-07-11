import express from 'express';
import { DiskStorage, uploadx } from 'node-uploadx';

const PORT = process.env.PORT || 3002;

const app = express();

const storage = new DiskStorage({
  uploadDir: process.env.UPLOAD_DIR || 'upload',
  maxFileSize: '1GB',
  logLevel: 'debug',
  onError(response) {
    const { code, message } = response;
    const page = (code || 'UnknownError').toLowerCase();
    const documentation_url = `http://example.com/api/v1/docs/upload/error/${page}`;
    const body = { message, documentation_url };
    return { ...response, body };
  }
});

storage.errorResponses = {
  FileNotFound: {
    statusCode: 404,
    code: 'FileNotFound',
    message: 'Not Found!'
  },
  RequestEntityTooLarge: {
    statusCode: 413,
    code: 'RequestEntityTooLarge',
    message: 'Request entity too large'
  }
};

app.use('/files', uploadx({ storage }));

app.listen(PORT, () => {
  console.log('listening on port:', PORT);
});
