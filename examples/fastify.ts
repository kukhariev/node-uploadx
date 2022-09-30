import Fastify from 'fastify';
import middie from '@fastify/middie';
import { Uploadx } from '@uploadx/core';
import { join } from 'path';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info', name: 'uploadx' });

const port = process.env.PORT || 3002;

async function build() {
  const uploadx = new Uploadx({ directory: 'upload', logger });
  uploadx.on('completed', ({ name, originalName }) =>
    logger.info(`upload complete, path: ${join('files', name)}, original filename: ${originalName}`)
  );
  const fastify = Fastify({ logger });
  await fastify.register(middie);

  void fastify.use(uploadx.handle);
  return fastify;
}

build()
  .then(fastify => fastify.listen({ port: +port }))
  .catch(logger.error);
