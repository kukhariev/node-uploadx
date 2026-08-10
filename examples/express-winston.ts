import { install } from '@logtape/adaptor-winston';
import { uploadx } from '@uploadx/core';
import express from 'express';
import winston from 'winston';

const PORT = process.env.PORT || 3002;
const app = express();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'error',
  format: winston.format.combine(
    winston.format.label({ label: 'uploadx' }),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

install(logger);

const uploads = uploadx({
  uploadDir: process.env.UPLOAD_DIR || 'upload',
  maxFileSize: '5GB',
  allowedMimeTypes: ['video/*', 'image/*'],
  expiration: '1h'
});

app.use('/files', uploads);

app.listen(PORT, () => logger.info(`listening on port: ${PORT}`));
