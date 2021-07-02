import * as express from 'express';
import { DiskFile, DiskStorage, OnComplete, uploadx } from 'node-uploadx';

const app = express();

const auth: express.Handler = (req, res, next) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  (req as any)['user'] = { id: '92be348f-172d-5f69-840d-100f79e4d1ef' };
  next();
};

app.use(auth);

type OnCompleteBody = {
  message: string;
  id: string;
};

const onComplete: OnComplete<DiskFile, OnCompleteBody> = file => {
  const message = `File upload is finished, path: ${file.name}`;
  console.log(message);
  return {
    message,
    id: file.id
  };
};

const storage = new DiskStorage({
  maxUploadSize: '1GB',
  directory: 'upload',
  maxMetadataSize: '1mb',
  onComplete,
  validation: {
    mime: { value: ['video/*'], response: [415, { error: 'video only' }] },
    mtime: {
      isValid: file => !!file.metadata.lastModified,
      response: [403, { error: 'missing lastModified' }]
    },
    filename: {
      isValid: file => file.name.length < 255 && /^[a-z0-9_.@()-]+$/i.test(file.originalName),
      response: [400, { error: 'invalid filename' }]
    }
  }
});

app.use('/files', uploadx({ storage }));

app.listen(3002, () => {
  console.log('listening on port:', 3002);
});
