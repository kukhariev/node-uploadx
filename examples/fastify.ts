import * as Fastify from 'fastify';
import { Uploadx } from 'node-uploadx';
import { join } from 'path';

const fastify = Fastify({ logger: true });
const uploadx = new Uploadx({ directory: 'files' });
uploadx.on('completed', ({ name, originalName }) =>
  fastify.log.info(
    `upload complete, path: ${join('files', name)}, original filename: ${originalName}`
  )
);

fastify.use('/upload/files', uploadx.handle);

fastify.listen(3003, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
