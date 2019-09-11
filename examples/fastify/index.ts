import * as Fastify from 'fastify';
import { uploadx } from '../../dist';

const fastify = Fastify({ logger: true });

fastify.use('/upload', uploadx());

fastify.get('/upload', ({ req }, reply) => {
  reply.send((req as any)['body']);
});

fastify.listen(3003, (err, address) => {
  if (err) throw err;
  fastify.log.info(`server listening on ${address}`);
});
