import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';

// The service imports burndown.js → db/pool.js; keep the DB out of these tests.
vi.mock('../src/services/burndown.js', () => ({
  listProjectsWithStats: vi.fn(async () => []),
}));

// ai-dashboard.js reads OLLAMA_URL / OLLAMA_MODEL at module load, so every test
// sets the env first and then imports a fresh copy of the module.
async function loadService({ url, model } = {}) {
  if (url === undefined) delete process.env.OLLAMA_URL;
  else process.env.OLLAMA_URL = url;
  if (model === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = model;
  vi.resetModules();
  return import('../src/services/ai-dashboard.js');
}

function tagsResponse(names) {
  return {
    ok:   true,
    status: 200,
    json: async () => ({ models: names.map(n => ({ name: n, model: n })) }),
  };
}

const savedEnv = { url: process.env.OLLAMA_URL, model: process.env.OLLAMA_MODEL };
const savedFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  global.fetch = savedFetch;
  if (savedEnv.url === undefined) delete process.env.OLLAMA_URL;
  else process.env.OLLAMA_URL = savedEnv.url;
  if (savedEnv.model === undefined) delete process.env.OLLAMA_MODEL;
  else process.env.OLLAMA_MODEL = savedEnv.model;
});

describe('checkOllamaStatus()', () => {
  it('returns ready when the exact configured model is installed', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockResolvedValue(tagsResponse(['qwen3-vl:8b', 'qwen2.5:7b']));
    expect(await checkOllamaStatus()).toBe('ready');
  });

  it('returns model_missing when only another model is installed', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockResolvedValue(tagsResponse(['qwen3-vl:8b']));
    expect(await checkOllamaStatus()).toBe('model_missing');
  });

  it('returns model_missing when only another tag of the same family is installed', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockResolvedValue(tagsResponse(['qwen2.5:14b']));
    expect(await checkOllamaStatus()).toBe('model_missing');
  });

  it('treats an untagged configured model as :latest', async () => {
    const { checkOllamaStatus } = await loadService({ model: 'llama3' });
    global.fetch.mockResolvedValue(tagsResponse(['llama3:latest']));
    expect(await checkOllamaStatus()).toBe('ready');
  });

  it('returns unavailable on a non-OK response', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    expect(await checkOllamaStatus()).toBe('unavailable');
  });

  it('returns unavailable when the host Ollama cannot be reached', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockRejectedValue(new TypeError('fetch failed'));
    expect(await checkOllamaStatus()).toBe('unavailable');
  });

  it('defaults to the Docker host address when OLLAMA_URL is unset', async () => {
    const { checkOllamaStatus } = await loadService();
    global.fetch.mockResolvedValue(tagsResponse(['qwen2.5:7b']));
    await checkOllamaStatus();
    expect(global.fetch.mock.calls[0][0]).toBe('http://host.docker.internal:11434/api/tags');
  });

  it('uses an overridden OLLAMA_URL and strips a trailing slash', async () => {
    const { checkOllamaStatus } = await loadService({ url: 'http://macmini.local:11434/' });
    global.fetch.mockResolvedValue(tagsResponse(['qwen2.5:7b']));
    await checkOllamaStatus();
    expect(global.fetch.mock.calls[0][0]).toBe('http://macmini.local:11434/api/tags');
  });
});

describe('SYSTEM_PROMPT', () => {
  it('documents the turnover building blocks', async () => {
    const { SYSTEM_PROMPT } = await loadService();
    expect(SYSTEM_PROMPT).toContain('ProjectTurnover(projectId)');
    expect(SYSTEM_PROMPT).toContain('TurnoverOverview(year)');
    expect(SYSTEM_PROMPT).toContain('TurnoverOverview()');
    expect(SYSTEM_PROMPT).toContain('TimesheetSummary(projectId, month)');
  });

  it('requires the root statement first (progressive rendering)', async () => {
    const { SYSTEM_PROMPT } = await loadService();
    expect(SYSTEM_PROMPT).toContain('FIRST statement MUST be');
    expect(SYSTEM_PROMPT).toContain('root = Dashboard(');
    expect(SYSTEM_PROMPT).not.toContain('The LAST statement MUST be');
  });

  it('shows a root-first example', async () => {
    const { SYSTEM_PROMPT } = await loadService();
    const lines = SYSTEM_PROMPT.split('\n');
    const idx = lines.findIndex(l => l.startsWith('Example'));
    expect(idx).toBeGreaterThan(-1);
    const firstCode = lines.slice(idx + 1).find(l => l.trim());
    expect(firstCode.startsWith('root = Dashboard(')).toBe(true);
  });
});

describe('default declaration', () => {
  it('shows the turnover overview and the timesheet, but no per-project turnover', async () => {
    const text = (await readFile(new URL('../dashboard.declaration.md', import.meta.url), 'utf8')).toLowerCase();
    expect(text).toContain('turnover overview');
    expect(text).toContain('timesheet');
    expect(text).not.toContain('project turnover');
  });
});
