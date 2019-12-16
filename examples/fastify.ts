import * as Fastify from 'fastify';
import { Uploadx } from '../src';
import { join } from 'path';

const fastify = Fastify({ logger: true });
const uploadx = new Uploadx({ directory: 'files' });
uploadx.on('completed', ({ path, filename }) =>
  fastify.log.info(`upload complete, path: ${join('files', path)}, original filename: ${filename}`)
);

fastify.use('/upload/files', uploadx.handle);

fastify.listen(3003, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
