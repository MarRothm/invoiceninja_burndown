import { listProjectsWithStats, getBurndown } from '../services/burndown.js';
import { getTimesheet, parseMonth } from '../services/timesheet.js';
import { getProjectTurnover, getYearTurnover, parseYear } from '../services/turnover.js';
import { runFullSync } from '../services/sync.js';
import { invalidateAICache } from '../services/ai-dashboard.js';

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

  // GET /projects/:id/timesheet?month=YYYY-MM – daily totals for one month
  fastify.get('/projects/:id/timesheet', async (req, reply) => {
    const id = parseId(req.params.id);
    if (id === null) return reply.status(400).send({ error: 'Invalid project id' });
    if (!parseMonth(req.query.month)) {
      return reply.status(400).send({ error: 'Invalid month, expected YYYY-MM' });
    }

    const data = await getTimesheet(id, req.query.month);
    if (!data) return reply.status(404).send({ error: 'Project not found' });
    return data;
  });

  // GET /projects/:id/turnover – invoiced / paid / open per invoice year
  fastify.get('/projects/:id/turnover', async (req, reply) => {
    const id = parseId(req.params.id);
    if (id === null) return reply.status(400).send({ error: 'Invalid project id' });

    const data = await getProjectTurnover(id);
    if (!data) return reply.status(404).send({ error: 'Project not found' });
    return data;
  });

  // GET /turnover?year=YYYY – invoiced / paid / open per project for one year
  fastify.get('/turnover', async (req, reply) => {
    const year = parseYear(req.query.year);
    if (year === null) return reply.status(400).send({ error: 'Invalid year, expected YYYY' });
    return getYearTurnover(year);
  });

  // POST /sync – trigger manual sync (strict rate limit: 5 per minute)
  fastify.post('/sync', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const result = await runFullSync();
    invalidateAICache();
    return { ok: true, ...result };
  });

  // GET /health
  fastify.get('/health', async () => ({ ok: true, ts: new Date().toISOString() }));
}
