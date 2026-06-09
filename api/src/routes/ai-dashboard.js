import { checkOllamaStatus, generateOrCachedLayout, getThresholds, isCached, debugInfo, updateDeclaration } from '../services/ai-dashboard.js';

export async function aiDashboardRoutes(fastify) {
  // GET /ai-dashboard/status — AI service health check for toggle enablement
  fastify.get('/ai-dashboard/status', async (req, reply) => {
    const ollama = await checkOllamaStatus();
    return {
      ollama,
      model: process.env.OLLAMA_MODEL ?? 'qwen2.5:7b',
      cached: isCached(),
    };
  });

  // GET /ai-dashboard/config — parsed thresholds from declaration (for frontend StatusBadge)
  fastify.get('/ai-dashboard/config', async () => {
    const thresholds = await getThresholds();
    return { thresholds };
  });

  // PUT /ai-dashboard/declaration — update declaration at runtime without image rebuild
  fastify.put('/ai-dashboard/declaration', async (req, reply) => {
    const { content } = req.body ?? {};
    if (typeof content !== 'string' || !content.trim()) {
      return reply.code(400).send({ error: 'content must be a non-empty string' });
    }
    await updateDeclaration(content);
    return { ok: true };
  });

  // GET /ai-dashboard/debug — full diagnostic (non-streaming)
  fastify.get('/ai-dashboard/debug', async () => {
    return debugInfo();
  });

  // GET /ai-dashboard — SSE stream of openUI Lang layout tokens
  fastify.get('/ai-dashboard', async (req, reply) => {
    const raw = reply.raw;
    raw.writeHead(200, {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no', // disable Nginx buffering for SSE
    });

    const write = (data) => raw.write(`data: ${data}\n\n`);

    try {
      await generateOrCachedLayout(write);
      write('[DONE]');
    } catch (err) {
      fastify.log.error(err);
      const code = err.code === 'AI_UNAVAILABLE' ? 503
                 : err.code === 'AI_TIMEOUT'     ? 504
                 : err.code === 'DECLARATION_MISSING' ? 500
                 : 500;
      write(JSON.stringify({ error: err.code ?? 'internal_error', status: code }));
      write('[DONE]');
    } finally {
      raw.end();
    }
  });
}
