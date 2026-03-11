import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { projectRoutes } from './routes/projects.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
});

await fastify.register(projectRoutes, { prefix: '/api' });

try {
  await fastify.listen({ port: parseInt(process.env.PORT ?? '3000'), host: '0.0.0.0' });
  console.log(`API running on port ${process.env.PORT ?? 3000}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
