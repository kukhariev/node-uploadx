import * as express from 'express';
import { DiskFile, DiskStorage, OnComplete, uploadx, UploadxResponse } from 'node-uploadx';

const app = express();

type OnCompleteBody = {
  message: string;
  id: string;
};

const onComplete: OnComplete<DiskFile, UploadxResponse<OnCompleteBody>> = file => {
  const message = `File upload is finished, path: ${file.name}`;
  console.log(message);
  return {
    statusCode: 200,
    message,
    id: file.id,
    headers: { ETag: file.id }
  };
};

const storage = new DiskStorage({
  directory: 'upload',
  onComplete,
  expiration: { maxAge: '1h', purgeInterval: '10min' },
  validation: {
    mime: { value: ['video/*'], response: [415, { message: 'video only' }] },
    size: {
      isValid(file) {
        this.response = [412, { message: `The file size(${file.size}) is larger than 5GiB` }];
        return file.size <= 5368709120;
      }
    },
    mtime: {
      isValid: file => !!file.metadata.lastModified,
      response: [403, { message: 'Missing `lastModified` property' }]
    }
  }
});

app.use('/files', uploadx({ storage }));

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
