import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFile } from 'fs/promises';
import { listProjectsWithStats } from '../src/services/burndown.js';

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

describe('SYSTEM_PROMPT lump sum (008)', () => {
  it('tells the model to skip burndown/timesheet for lump-sum projects and keep the list order', async () => {
    const { SYSTEM_PROMPT } = await loadService();
    expect(SYSTEM_PROMPT).toContain('billing_mode');
    expect(SYSTEM_PROMPT).toContain('lump_sum');
    expect(SYSTEM_PROMPT).toContain('never use BurndownChart or TimesheetSummary');
    expect(SYSTEM_PROMPT).toContain('Keep the order of the project list');
  });
});

describe('generateOrCachedLayout lump sum (008)', () => {
  const ollamaStream = () => new Response(
    'data: {"choices":[{"delta":{"content":"root = Dashboard([card3])\\ncard3 = ProjectCard(3)"}}]}\n\ndata: [DONE]\n\n',
    { status: 200 },
  );
  const projects = () => [
    { id: 1, name: 'A', billing_mode: 'hourly',   progress: 50, status: 'in_progress', lump_sum: null },
    { id: 2, name: 'B', billing_mode: 'lump_sum', progress: 0,  status: 'in_progress',
      lump_sum: { agreed: 1000, currency: 'EUR', invoiced: 300, earned_pct: 30 } },
    { id: 3, name: 'C', billing_mode: 'hourly',   progress: 90, status: 'in_progress', lump_sum: null },
    { id: 4, name: 'D', billing_mode: 'hourly',   progress: 99, status: 'closed',      lump_sum: null },
  ];
  const sentProjects = (call) => {
    const body = JSON.parse(global.fetch.mock.calls[call][1].body);
    const user = body.messages.find(m => m.role === 'user').content;
    return JSON.parse(user.slice(user.indexOf('['), user.lastIndexOf(']') + 1));
  };

  it('orders hourly by progress, then lump sum, and marks lump-sum projects', async () => {
    const { generateOrCachedLayout } = await loadService();
    vi.mocked(listProjectsWithStats).mockResolvedValue(projects());
    global.fetch.mockImplementation(async () => ollamaStream());

    await generateOrCachedLayout(() => {});

    const sent = sentProjects(0);
    expect(sent.map(p => p.id)).toEqual([3, 1, 2]);
    expect(sent[2]).toMatchObject({ billing_mode: 'lump_sum', progress: null, earned_pct: 30 });
    expect(sent[0]).toMatchObject({ billing_mode: 'hourly', progress: 90 });
  });

  it('serves the cache until a billing mode changes', async () => {
    const { generateOrCachedLayout } = await loadService();
    global.fetch.mockImplementation(async () => ollamaStream());
    vi.mocked(listProjectsWithStats).mockResolvedValue(projects());

    await generateOrCachedLayout(() => {});
    await generateOrCachedLayout(() => {});
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const changed = projects();
    changed[0] = { ...changed[0], billing_mode: 'lump_sum',
      lump_sum: { agreed: null, currency: 'EUR', invoiced: 0, earned_pct: null } };
    vi.mocked(listProjectsWithStats).mockResolvedValue(changed);

    await generateOrCachedLayout(() => {});
    expect(global.fetch).toHaveBeenCalledTimes(2);
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
