import fastify from 'fastify';
import middie from 'middie';
import { Uploadx } from '@uploadx/core';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'uploadx' });

const PORT = process.env.PORT || 3002;

const server = fastify({ logger: true });
const uploadx = new Uploadx({ directory: 'upload', logger });
uploadx.on('completed', ({ name, originalName }) =>
  server.log.info(
    `upload complete, path: ${join('files', name)}, original filename: ${originalName}`
  )
);

server.register(middie).then(
  () => {
    void server.use('/files', uploadx.handle);
    return server.listen(PORT, (err, address) => {
      if (err) throw err;
      server.log.info(`server listening on ${address}`);
    });
  },
  e => console.error(e)
);
