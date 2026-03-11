import { listProjectsWithStats, getBurndown } from '../services/burndown.js';
import { runFullSync } from '../services/sync.js';

export async function projectRoutes(fastify) {
  // GET /projects – list all projects with stats
  fastify.get('/projects', async (req, reply) => {
    const projects = await listProjectsWithStats();
    return { data: projects };
  });

  // GET /projects/:id/burndown – burndown chart data
  fastify.get('/projects/:id/burndown', async (req, reply) => {
    const { id } = req.params;
    const data = await getBurndown(parseInt(id));
    if (!data) return reply.status(404).send({ error: 'Project not found' });
    return data;
  });

  // POST /sync – trigger manual sync
  fastify.post('/sync', async (req, reply) => {
    const result = await runFullSync();
    return { ok: true, ...result };
  });

  // GET /health
  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
