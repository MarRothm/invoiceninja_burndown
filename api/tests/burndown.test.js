import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock the DB pool before importing the module ──────────────────────────
vi.mock('../src/db/pool.js', () => ({
  query: vi.fn(),
}));

import { query } from '../src/db/pool.js';
import { getBurndown, listProjectsWithStats } from '../src/services/burndown.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeProject(overrides = {}) {
  return {
    id:              1,
    name:            'Test Project',
    budgeted_hours:  '100',
    deadline:        '2099-12-31',  // far future so project is in_progress by default
    start_date:      '2024-01-01',
    actual_end_date: null,
    updated_at:      new Date('2024-01-01'),
    ...overrides,
  };
}

/**
 * Configure query mock for getBurndown calls:
 *   1st call → project row
 *   2nd call → time_entries rows
 */
function setupBurndownMocks(project, entries = []) {
  query
    .mockResolvedValueOnce({ rows: [project] })
    .mockResolvedValueOnce({ rows: entries });
}

// ── getBurndown ───────────────────────────────────────────────────────────

describe('getBurndown', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when project does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await getBurndown(999);
    expect(result).toBeNull();
  });

  it('returns project metadata with correct fields', async () => {
    setupBurndownMocks(makeProject());
    const { project } = await getBurndown(1);
    expect(project).toMatchObject({
      id:             1,
      name:           'Test Project',
      budgeted_hours: 100,
      status:         'in_progress',
    });
  });

  it('marks project as closed when past deadline', async () => {
    const proj = makeProject({ deadline: '2020-01-01' }); // clearly in the past
    setupBurndownMocks(proj);
    const { project } = await getBurndown(1);
    expect(project.status).toBe('closed');
  });

  it('marks project as closed when actual_end_date is set', async () => {
    const proj = makeProject({ actual_end_date: '2024-01-15', deadline: '2099-12-31' });
    setupBurndownMocks(proj);
    const { project } = await getBurndown(1);
    expect(project.status).toBe('closed');
  });

  it('ideal line starts at budgeted_hours on first day', async () => {
    setupBurndownMocks(makeProject({ start_date: '2020-01-01', deadline: '2020-01-31' }));
    const { burndown } = await getBurndown(1);
    expect(burndown[0].ideal).toBe(100);
  });

  it('ideal line is 0 or close to 0 on last planned day', async () => {
    setupBurndownMocks(makeProject({ start_date: '2020-01-01', deadline: '2020-01-31' }));
    const { burndown } = await getBurndown(1);
    const last = burndown[burndown.length - 1];
    expect(last.ideal).toBeLessThanOrEqual(5); // last step is near 0
  });

  it('actual line is null for future dates', async () => {
    // Use a project with deadline far in the future
    const proj = makeProject({
      start_date: '2020-01-01',
      deadline:   '2099-12-31',
      actual_end_date: null,
    });
    setupBurndownMocks(proj);
    const { burndown } = await getBurndown(1);
    const futureEntries = burndown.filter(d => d.date > new Date().toISOString().slice(0, 10));
    expect(futureEntries.length).toBeGreaterThan(0);
    expect(futureEntries.every(d => d.actual === null)).toBe(true);
  });

  it('actual line has values for past and present dates', async () => {
    const proj = makeProject({
      start_date: '2020-01-01',
      deadline:   '2099-12-31',
    });
    const today = new Date().toISOString().slice(0, 10);
    setupBurndownMocks(proj, [{ date: '2020-01-01', hours: '10' }]);
    const { burndown } = await getBurndown(1);
    const pastEntries = burndown.filter(d => d.date <= today);
    expect(pastEntries.every(d => d.actual !== null)).toBe(true);
  });

  it('subtracts logged hours from budgeted_hours in actual line', async () => {
    const proj = makeProject({
      budgeted_hours: '100',
      start_date: '2020-01-01',
      deadline: '2020-01-05',
    });
    const entries = [{ date: '2020-01-01', hours: '25' }];
    setupBurndownMocks(proj, entries);
    const { burndown } = await getBurndown(1);
    // After first day: 100 - 25 = 75
    const jan01 = burndown.find(d => d.date === '2020-01-01');
    expect(jan01.actual).toBe(75);
  });

  it('actual never goes below 0', async () => {
    const proj = makeProject({
      budgeted_hours: '10',
      start_date: '2020-01-01',
      deadline: '2020-01-03',
    });
    const entries = [{ date: '2020-01-01', hours: '50' }]; // way over budget
    setupBurndownMocks(proj, entries);
    const { burndown } = await getBurndown(1);
    burndown.filter(d => d.actual !== null).forEach(d => {
      expect(d.actual).toBeGreaterThanOrEqual(0);
    });
  });

  it('returns correct total_logged in stats', async () => {
    const proj = makeProject({ budgeted_hours: '100', start_date: '2020-01-01', deadline: '2020-01-10' });
    const entries = [
      { date: '2020-01-01', hours: '8' },
      { date: '2020-01-02', hours: '6' },
    ];
    setupBurndownMocks(proj, entries);
    const { stats } = await getBurndown(1);
    expect(stats.total_logged).toBe(14);
  });

  it('calculates progress percentage correctly', async () => {
    const proj = makeProject({ budgeted_hours: '100', start_date: '2020-01-01', deadline: '2020-01-10' });
    const entries = [{ date: '2020-01-01', hours: '40' }];
    setupBurndownMocks(proj, entries);
    const { stats } = await getBurndown(1);
    expect(stats.progress).toBe(40);
  });

  it('returns progress 0 when budgeted_hours is 0', async () => {
    const proj = makeProject({ budgeted_hours: '0', start_date: '2020-01-01', deadline: '2020-01-10' });
    setupBurndownMocks(proj);
    const { stats } = await getBurndown(1);
    expect(stats.progress).toBe(0);
  });

  it('remaining is 0 for closed projects', async () => {
    const proj = makeProject({ deadline: '2020-01-01', actual_end_date: '2020-01-01' });
    const entries = [{ date: '2020-01-01', hours: '30' }];
    setupBurndownMocks(proj, entries);
    const { stats } = await getBurndown(1);
    expect(stats.remaining).toBe(0);
  });

  it('builds daily burndown entries with date, ideal, actual, logged fields', async () => {
    const proj = makeProject({ start_date: '2020-01-01', deadline: '2020-01-03' });
    setupBurndownMocks(proj);
    const { burndown } = await getBurndown(1);
    expect(burndown[0]).toHaveProperty('date');
    expect(burndown[0]).toHaveProperty('ideal');
    expect(burndown[0]).toHaveProperty('actual');
    expect(burndown[0]).toHaveProperty('logged');
  });
});

// ── listProjectsWithStats ─────────────────────────────────────────────────

describe('listProjectsWithStats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns mapped projects with progress and status', async () => {
    const rows = [{
      id: 1, invoiceninja_id: 'abc', name: 'P1',
      budgeted_hours: '100', deadline: '2099-01-01',
      actual_end_date: null, start_date: '2024-01-01',
      total_logged: '40',
    }];
    query.mockResolvedValueOnce({ rows });
    const result = await listProjectsWithStats();
    expect(result[0].progress).toBe(40);
    expect(result[0].status).toBe('in_progress');
    expect(result[0].remaining).toBe(60);
  });

  it('marks project with past deadline as closed', async () => {
    const rows = [{
      id: 1, invoiceninja_id: 'abc', name: 'P1',
      budgeted_hours: '100', deadline: '2020-01-01',
      actual_end_date: null, start_date: '2020-01-01',
      total_logged: '80',
    }];
    query.mockResolvedValueOnce({ rows });
    const result = await listProjectsWithStats();
    expect(result[0].status).toBe('closed');
    expect(result[0].remaining).toBe(0);
  });

  it('handles zero budgeted_hours without division errors', async () => {
    const rows = [{
      id: 1, invoiceninja_id: 'abc', name: 'P1',
      budgeted_hours: '0', deadline: null,
      actual_end_date: null, start_date: null,
      total_logged: '0',
    }];
    query.mockResolvedValueOnce({ rows });
    const result = await listProjectsWithStats();
    expect(result[0].progress).toBe(0);
    expect(result[0].remaining).toBe(0);
  });
});
