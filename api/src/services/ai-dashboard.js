import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { listProjectsWithStats } from './burndown.js';

const ollamaBaseUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434';
const model         = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
// Baked-in default (COPY in Dockerfile)
const declarationPath = resolve(process.cwd(), 'dashboard.declaration.md');
// Runtime override — written here by PUT /api/ai-dashboard/declaration
const DATA_DIR = process.env.DECLARATION_DATA_DIR ?? '/app/data';
const declarationDataPath = resolve(DATA_DIR, 'dashboard.declaration.md');

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
For each project display a ProjectCard, a BurndownChart, and a StatusBadge.`;

async function readDeclaration() {
  // Runtime override takes priority (volume-mounted, operator-editable without rebuild)
  try { return await readFile(declarationDataPath, 'utf8'); } catch { /* no override */ }
  // Fall back to baked-in default
  try { return await readFile(declarationPath, 'utf8'); } catch { /* no file */ }
  return DEFAULT_DECLARATION;
}

function computeDeclarationHash(content) {
  return createHash('sha256').update(content).digest('hex');
}

// Parses operator-defined percentage thresholds from plain-prose declaration.
// Looks for numbers near "at-risk" / "over-budget" keywords; falls back to 80/100.
function parseThresholds(declaration) {
  const atRiskMatch     = declaration.match(/at[-\s]?risk[^.]*?(\d+)\s*%/i);
  const overBudgetMatch = declaration.match(/over[-\s]?budget[^.]*?(\d+)\s*%/i);
  return {
    atRisk:     atRiskMatch     ? parseInt(atRiskMatch[1],     10) : 80,
    overBudget: overBudgetMatch ? parseInt(overBudgetMatch[1], 10) : 100,
  };
}

export async function getThresholds() {
  const declaration = await readDeclaration();
  return parseThresholds(declaration);
}

export async function updateDeclaration(content) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(declarationDataPath, content, 'utf8');
  invalidateAICache();
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
- ProjectCard(projectId)   — project summary card with built-in status badge; projectId is a number
- BurndownChart(projectId) — burndown chart; projectId is a number
- Dashboard(children)      — root container; children is an array of components  ← REQUIRED

Rules:
1. The LAST statement MUST be:  root = Dashboard([...all components...])
2. Use EXACT project IDs from the project list.
3. Place every component inside Dashboard's children array.
4. Output NOTHING outside the program (no greetings, no explanations).
5. EVERY project in the list with status "in_progress" MUST appear in the output — including projects with 0 hours logged. Do not skip any project.
6. Order projects by their \`progress\` field as directed in the declaration.

Example for two projects (IDs 1 and 3):
card1 = ProjectCard(1)
chart1 = BurndownChart(1)
card3 = ProjectCard(3)
chart3 = BurndownChart(3)
root = Dashboard([card1, chart1, card3, chart3])`;

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
  // Sort by budget consumption descending so the model renders them in the declared order
  const projects = (await listProjectsWithStats())
    .filter(p => p.status === 'in_progress')
    .sort((a, b) => b.progress - a.progress);
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
    result.declarationPreview = decl.slice(0, 120);
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
