import { configure, getConsoleSink, getLogger } from '@logtape/logtape';
import { uploadx } from '@uploadx/core';
import express from 'express';

const PORT = process.env.PORT || 3002;
const app = express();
const appLogger = getLogger(['uploadx', 'app']);

async function startApp() {
  await configure({
    sinks: {
      console: getConsoleSink()
    },
    loggers: [
      {
        category: ['uploadx'],
        lowestLevel: 'debug',
        sinks: ['console']
      },
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console']
      }
    ]
  });

  const uploads = uploadx({
    directory: process.env.UPLOAD_DIR || 'upload',
    maxUploadSize: '1GB',
    allowMIME: ['video/*', 'image/*'],
    useRelativeLocation: true,
    filename: file => file.originalName,
    expiration: { maxAge: '1h', purgeInterval: '10min' }
  });

  app.use('/files', uploads);

  app.listen(PORT, () => appLogger.info('listening on port: {port}', { port: PORT }));
}

startApp().catch((err: unknown) => appLogger.error('Server failed to start: {err}', { err }));
