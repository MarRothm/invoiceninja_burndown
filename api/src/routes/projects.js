import { listProjectsWithStats, getBurndown } from '../services/burndown.js';
import { runFullSync } from '../services/sync.js';

/**
 * Parse and validate a route :id param as a positive integer.
 * Returns the integer or null if invalid.
 */
function parseId(raw) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0 || String(n) !== String(raw)) return null;
  return n;
}

export async function projectRoutes(fastify) {
  // GET /projects – list all projects with stats
  fastify.get('/projects', async (req, reply) => {
    const projects = await listProjectsWithStats();
    return { data: projects };
  });

  // GET /projects/:id/burndown – burndown chart data
  fastify.get('/projects/:id/burndown', async (req, reply) => {
    const id = parseId(req.params.id);
    if (id === null) return reply.status(400).send({ error: 'Invalid project id' });

    const data = await getBurndown(id);
    if (!data) return reply.status(404).send({ error: 'Project not found' });
    return data;
  });

  // POST /sync – trigger manual sync (strict rate limit: 5 per minute)
  fastify.post('/sync', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const result = await runFullSync();
    return { ok: true, ...result };
  });

  // GET /health
  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
