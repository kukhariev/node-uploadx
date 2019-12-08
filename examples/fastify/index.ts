import * as Fastify from 'fastify';
import { uploadx } from '../../src';

const fastify = Fastify({ logger: true });

fastify.use('/upload', uploadx());

fastify.listen(3003, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
