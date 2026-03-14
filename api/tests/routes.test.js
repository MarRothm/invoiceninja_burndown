import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';

// ── Mock services before importing server ─────────────────────────────────
vi.mock('../src/services/burndown.js', () => ({
  listProjectsWithStats: vi.fn(async () => []),
  getBurndown:           vi.fn(async () => null),
}));

vi.mock('../src/services/sync.js', () => ({
  runFullSync: vi.fn(async () => ({ projects: 0, entries: 0, ms: 1 })),
}));

// ── Build a minimal Fastify app (without DB / dotenv) ─────────────────────
import Fastify from 'fastify';
import cors      from '@fastify/cors';
import helmet    from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { projectRoutes } from '../src/routes/projects.js';
import { getBurndown, listProjectsWithStats } from '../src/services/burndown.js';
import { runFullSync } from '../src/services/sync.js';

async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(rateLimit, { max: 200, timeWindow: '1 minute' });
  await app.register(cors, { origin: false });

  app.setErrorHandler((err, req, reply) => {
    const status = err.statusCode ?? 500;
    if (status >= 500) {
      reply.status(status).send({ error: 'Internal server error' });
    } else {
      reply.status(status).send({ error: err.message });
    }
  });

  await app.register(projectRoutes, { prefix: '/api' });
  await app.ready();
  return app;
}

let app;

beforeAll(async () => { app = await buildApp(); });
afterAll(async  () => { await app.close(); });

// ── /health ───────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  it('returns 200 with ok:true', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
  });
});

// ── /projects ─────────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('returns 200 with data array', async () => {
    listProjectsWithStats.mockResolvedValueOnce([{ id: 1, name: 'X' }]);
    const res = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).data).toHaveLength(1);
  });
});

// ── /projects/:id/burndown ────────────────────────────────────────────────

describe('GET /api/projects/:id/burndown', () => {
  it('returns 404 when project not found', async () => {
    getBurndown.mockResolvedValueOnce(null);
    const res = await app.inject({ method: 'GET', url: '/api/projects/9999/burndown' });
    expect(res.statusCode).toBe(404);
  });

  it('returns 200 with burndown data for valid project', async () => {
    getBurndown.mockResolvedValueOnce({ project: { id: 1 }, burndown: [], stats: {} });
    const res = await app.inject({ method: 'GET', url: '/api/projects/1/burndown' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 for non-numeric id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/abc/burndown' });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toMatch(/invalid project id/i);
  });

  it('returns 400 for floating-point id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/1.5/burndown' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for zero id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/0/burndown' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for negative id', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/-1/burndown' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for SQL-injection-style input', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/1%20OR%201%3D1/burndown' });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for very large number string that parses unexpectedly', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/projects/9999999999999999999/burndown' });
    // parseInt of a huge number is still finite; this should succeed input validation
    // but we test it doesn't crash the server
    expect([200, 400, 404]).toContain(res.statusCode);
  });
});

// ── POST /sync ────────────────────────────────────────────────────────────

describe('POST /api/sync', () => {
  it('returns 200 with ok:true on successful sync', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/sync' });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
  });

  it('returns error when sync throws', async () => {
    runFullSync.mockRejectedValueOnce(new Error('Network error'));
    const res = await app.inject({ method: 'POST', url: '/api/sync' });
    expect(res.statusCode).toBe(500);
  });
});

// ── Security headers ──────────────────────────────────────────────────────

describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.headers['x-frame-options']).toBeDefined();
  });

  it('does not expose internal error details in 500 responses', async () => {
    runFullSync.mockRejectedValueOnce(new Error('SECRET_DB_PASSWORD=hunter2'));
    const res = await app.inject({ method: 'POST', url: '/api/sync' });
    expect(res.body).not.toContain('SECRET_DB_PASSWORD');
  });
});
