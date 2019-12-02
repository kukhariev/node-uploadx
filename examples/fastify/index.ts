import * as Fastify from 'fastify';
import { tus } from '../../src';

const fastify = Fastify({ logger: true });

fastify.use('/upload', tus());

fastify.listen(3003, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
