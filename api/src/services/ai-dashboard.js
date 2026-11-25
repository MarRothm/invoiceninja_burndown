import { createHash } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { listProjectsWithStats } from './burndown.js';

const ollamaBaseUrl = (process.env.OLLAMA_URL ?? 'http://host.docker.internal:11434').replace(/\/+$/, '');
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

// Ollama treats an untagged model reference as `<name>:latest`.
const normModel = (n) => (n && !n.includes(':') ? `${n}:latest` : n);

export async function checkOllamaStatus() {
  try {
    const res = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return 'unavailable';
    const body = await res.json();
    // The host Ollama owns its models — the stack never pulls. Require the exact
    // configured model:tag; another tag of the same family does not count.
    const want = normModel(model);
    const models = body.models ?? [];
    const present = models.some(m => normModel(m.name) === want || normModel(m.model) === want);
    return present ? 'ready' : 'model_missing';
  } catch {
    return 'unavailable';
  }
}

// ── Declaration file ───────────────────────────────────────────────────────

// Fallback when no declaration file exists — keep in sync with api/dashboard.declaration.md
const DEFAULT_DECLARATION = `Show the turnover overview for the current year at the top.

Then show all in_progress projects ordered by budget consumed (highest progress percentage first).
Include every project with status "in_progress", even those with 0 hours logged.

For each project show a ProjectCard (which includes a built-in status badge and progress bar),
followed by its BurndownChart and the timesheet summary of the current month.`;

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

export const SYSTEM_PROMPT = `You generate dashboard layouts using OpenUI Lang.
Output ONLY valid OpenUI Lang program code — no prose, no HTML, no markdown, no explanations.

OpenUI Lang syntax rules:
- Assignment:  varName = Component(arg1, arg2)
- Array:       [item1, item2, item3]
- Strings:     "value"  (double quotes only)
- Numbers:     plain integers  (1, 42)
- Arguments are POSITIONAL — write only values, not key=value pairs

Available components (positional args):
- ProjectCard(projectId)   — project summary card (hours, or lump sum for billing_mode "lump_sum") with built-in status badge; projectId is a number
- BurndownChart(projectId) — burndown chart; projectId is a number
- ProjectTurnover(projectId) — invoiced/paid/open per year for one project
- TurnoverOverview(year) — cross-project turnover for one year; year is optional
- TimesheetSummary(projectId, month) — month total of booked hours + EUR for one project; month "YYYY-MM" is optional
- Dashboard(children)      — root container; children is an array of components  ← REQUIRED

Rules:
1. The FIRST statement MUST be:  root = Dashboard([...all component names in display order...]) — then define each component on its own line, in the same order.
2. Use EXACT project IDs from the project list.
3. Every component you define MUST be listed in Dashboard's children array.
4. Output NOTHING outside the program (no greetings, no explanations).
5. EVERY project in the list with status "in_progress" MUST appear in the output — including projects with 0 hours logged. Do not skip any project.
6. Keep the order of the project list (it is already sorted as the declaration directs).
7. Use ProjectTurnover only if the declaration asks for turnover per project; use TurnoverOverview only if it asks for a turnover overview. Never add them otherwise.
8. Pass a year only if the declaration names a specific year; otherwise write TurnoverOverview() with no argument.
9. Use TimesheetSummary only if the declaration asks for the timesheet. Pass a month only if the declaration names a specific month; otherwise write TimesheetSummary(projectId) with one argument.
10. For projects with billing_mode "lump_sum" never use BurndownChart or TimesheetSummary; where the declaration asks for them, use ProjectTurnover(projectId) once instead.

Example for two projects (IDs 1 and 3):
root = Dashboard([card1, chart1, card3, chart3])
card1 = ProjectCard(1)
chart1 = BurndownChart(1)
card3 = ProjectCard(3)
chart3 = BurndownChart(3)`;

// ── Ollama streaming ───────────────────────────────────────────────────────

async function streamFromOllama(declarationContent, projects, onToken) {
  const userMessage = `Declaration:\n${declarationContent}\n\nProjects:\n${JSON.stringify(
    projects.map(p => (p.billing_mode === 'lump_sum'
      ? {
          id:           p.id,
          name:         p.name,
          billing_mode: 'lump_sum',
          progress:     null,
          earned_pct:   p.lump_sum?.earned_pct ?? null,
          status:       p.status,
        }
      : {
          id:             p.id,
          name:           p.name,
          billing_mode:   'hourly',
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
    const e = new Error(`Ollama returned ${res.status} (${ollamaBaseUrl})`);
    // 404 = model not installed on the host Ollama → treat like unavailable
    e.code = (res.status === 503 || res.status === 404) ? 'AI_UNAVAILABLE' : 'AI_ERROR';
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

// Hourly projects by budget consumed (desc), then lump-sum projects by lump sum earned (desc, unset last).
function displayOrder(a, b) {
  const lsA = a.billing_mode === 'lump_sum';
  const lsB = b.billing_mode === 'lump_sum';
  if (lsA !== lsB) return lsA ? 1 : -1;
  if (!lsA) return b.progress - a.progress;
  return (b.lump_sum?.earned_pct ?? -1) - (a.lump_sum?.earned_pct ?? -1);
}

export async function generateOrCachedLayout(writeSSE) {
  const declaration = await readDeclaration();
  const projects = (await listProjectsWithStats())
    .filter(p => p.status === 'in_progress')
    .sort(displayOrder);

  // The layout depends on each project's billing mode (lump-sum projects get turnover instead of
  // burndown/timesheet) — a mode change after a worker sync must not reuse the old layout.
  const fingerprint = projects.map(p => `${p.id}:${p.billing_mode}`).sort().join(',');
  const hash = computeDeclarationHash(`${declaration}\n${fingerprint}`);

  if (cache && cache.hash === hash) {
    // Cache hit — serve full layout as a single event
    writeSSE(JSON.stringify({ cached: true, layout: cache.layout }));
    return;
  }

  // Cache miss — stream from Ollama
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
