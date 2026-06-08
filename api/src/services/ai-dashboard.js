import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { listProjectsWithStats } from './burndown.js';

const ollamaBaseUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434';
const model         = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const declarationPath = resolve(process.cwd(), 'dashboard.declaration.md');

// Ephemeral in-memory cache: { hash: string, layout: string } | null
let cache = null;

export function isCached() {
  return cache !== null;
}

export function invalidateAICache() {
  cache = null;
}

// ── Ollama health check ────────────────────────────────────────────────────

export async function checkOllamaStatus() {
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return 'unavailable';
    const body = await res.json();
    // If the model list endpoint responds but our model isn't ready yet, report pulling
    const models = body.models ?? [];
    const present = models.some(m => m.name?.startsWith(model.split(':')[0]));
    return present ? 'ready' : 'pulling';
  } catch {
    return 'unavailable';
  }
}

// ── Declaration file ───────────────────────────────────────────────────────

async function readDeclaration() {
  try {
    return await readFile(declarationPath, 'utf8');
  } catch (err) {
    const e = new Error('Declaration file missing or unreadable');
    e.code = 'DECLARATION_MISSING';
    throw e;
  }
}

function computeDeclarationHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate dashboard layouts using OpenUI Lang.
Emit ONLY self-closing component tags — no prose, no HTML, no explanations.

Available components:
- <ProjectCard projectId="NUMBER" />
- <BurndownChart projectId="NUMBER" />
- <StatusBadge status="on-budget" />  or  status="at-risk"  or  status="over-budget"

Rules:
- Use the exact project IDs provided in the project list.
- Emit one component per line.
- Do not emit any text outside of component tags.
- Unknown tag names are ignored by the renderer, so only use the three listed above.`;

// ── Ollama streaming ───────────────────────────────────────────────────────

async function streamFromOllama(declarationContent, projects, onToken) {
  const userMessage = `Declaration:\n${declarationContent}\n\nProjects:\n${JSON.stringify(
    projects.map(p => ({
      id:             p.id,
      name:           p.name,
      budgeted_hours: p.budgeted_hours,
      total_logged:   p.total_logged,
      progress:       p.progress,
      status:         p.status,
    })),
    null, 2
  )}\n\nGenerate the dashboard layout now.`;

  let res;
  try {
    res = await fetch(`${ollamaBaseUrl}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userMessage },
        ],
        stream: true,
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      const e = new Error('Ollama timed out after 30s');
      e.code = 'AI_TIMEOUT';
      throw e;
    }
    const e = new Error('Ollama unreachable');
    e.code = 'AI_UNAVAILABLE';
    throw e;
  }

  if (!res.ok) {
    const e = new Error(`Ollama returned ${res.status}`);
    e.code = res.status === 503 ? 'AI_UNAVAILABLE' : 'AI_ERROR';
    throw e;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    // Only process complete lines; keep the trailing partial line in buffer
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') return accumulated;
      try {
        const parsed = JSON.parse(data);
        const token = parsed.choices?.[0]?.delta?.content ?? '';
        if (token) {
          accumulated += token;
          onToken(token);
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  return accumulated;
}

// ── Cache + generation ─────────────────────────────────────────────────────

export async function generateOrCachedLayout(writeSSE) {
  const declaration = await readDeclaration();
  const hash = computeDeclarationHash(declaration);

  if (cache && cache.hash === hash) {
    // Cache hit — serve full layout as a single event
    writeSSE(JSON.stringify({ cached: true, layout: cache.layout }));
    return;
  }

  // Cache miss — fetch projects and stream from Ollama
  const projects = await listProjectsWithStats();
  let accumulated = '';

  await streamFromOllama(declaration, projects, (token) => {
    accumulated += token;
    writeSSE(token);
  });

  // Only cache non-empty layouts — an empty response means Ollama had nothing to render
  if (accumulated.trim()) {
    cache = { hash, layout: accumulated };
  }
}
