import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { projectRoutes } from './routes/projects.js';

const fastify = Fastify({ logger: true });

// Security headers
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
});

// Rate limiting – global default: 200 req/min per IP
await fastify.register(rateLimit, {
  max: 200,
  timeWindow: '1 minute',
});

// CORS – restrict to configured origin; falls back to localhost in production
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? false,
});

// Custom error handler – never leak internal details for 5xx errors
fastify.setErrorHandler((err, req, reply) => {
  const status = err.statusCode ?? 500;
  fastify.log.error(err);
  if (status >= 500) {
    reply.status(status).send({ error: 'Internal server error' });
  } else {
    reply.status(status).send({ error: err.message });
  }
});

await fastify.register(projectRoutes, { prefix: '/api' });

try {
  await fastify.listen({ port: parseInt(process.env.PORT ?? '3000'), host: '0.0.0.0' });
  console.log(`API running on port ${process.env.PORT ?? 3000}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
