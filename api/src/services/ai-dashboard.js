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

const DEFAULT_DECLARATION = `Show all projects with their burndown charts and current status.
For each project display a ProjectCard, a BurndownChart, and a StatusBadge.
Order by project name.`;

async function readDeclaration() {
  try {
    return await readFile(declarationPath, 'utf8');
  } catch {
    return DEFAULT_DECLARATION;
  }
}

function computeDeclarationHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate dashboard layouts using OpenUI Lang.
Output ONLY valid OpenUI Lang program code — no prose, no HTML, no markdown, no explanations.

OpenUI Lang syntax rules:
- Assignment:  varName = Component(arg1, arg2)
- Array:       [item1, item2, item3]
- Strings:     "value"  (double quotes only)
- Numbers:     plain integers  (1, 42)
- Arguments are POSITIONAL — write only values, not key=value pairs

Available components (positional args):
- ProjectCard(projectId)   — project summary card; projectId is a number
- BurndownChart(projectId) — burndown chart;        projectId is a number
- StatusBadge(status)      — status badge;           status is one of "on-budget", "at-risk", "over-budget"
- Dashboard(children)      — root container;         children is an array of components  ← REQUIRED

Rules:
1. The LAST statement MUST be:  root = Dashboard([...all components...])
2. Use EXACT project IDs from the project list.
3. Place every component inside Dashboard's children array.
4. Output NOTHING outside the program (no greetings, no explanations).

Example for two projects (IDs 1 and 3):
card1 = ProjectCard(1)
chart1 = BurndownChart(1)
badge1 = StatusBadge("on-budget")
card3 = ProjectCard(3)
chart3 = BurndownChart(3)
badge3 = StatusBadge("at-risk")
root = Dashboard([card1, chart1, badge1, card3, chart3, badge3])`;

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

// ── Debug diagnostic (non-streaming) ──────────────────────────────────────

export async function debugInfo() {
  const result = {
    ollamaUrl:  ollamaBaseUrl,
    model,
    declarationPath,
    ollamaStatus: null,
    declarationFound: false,
    declarationLength: 0,
    projectCount: 0,
    ollamaHttpStatus: null,
    ollamaRawResponse: null,
    ollamaError: null,
    parsedTokens: [],
  };

  // Ollama status
  result.ollamaStatus = await checkOllamaStatus();

  // Declaration file
  try {
    const decl = await readFile(declarationPath, 'utf8');
    result.declarationFound = true;
    result.declarationLength = decl.length;
  } catch {
    result.declarationFound = false;
  }

  // Projects
  try {
    const projects = await listProjectsWithStats();
    result.projectCount = projects.length;
    result.projectIds = projects.map(p => ({ id: p.id, name: p.name }));
  } catch (e) {
    result.projectsError = e.message;
  }

  // Non-streaming Ollama request with a minimal prompt
  try {
    const res = await fetch(`${ollamaBaseUrl}/v1/chat/completions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'Reply with exactly: <ProjectCard projectId="1" />' },
          { role: 'user',   content: 'Generate.' },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    result.ollamaHttpStatus = res.status;
    const body = await res.json();
    result.ollamaRawResponse = body;
    result.parsedContent = body?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    result.ollamaError = e.message;
  }

  return result;
}
