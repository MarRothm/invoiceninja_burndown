import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/db/pool.js', () => ({ query: vi.fn() }));

import { query } from '../src/db/pool.js';
import {
  getProjectTurnover, getYearTurnover, parseYear, toTurnoverRow,
} from '../src/services/turnover.js';

beforeEach(() => vi.mocked(query).mockReset());

const synced = { rows: [{ last_synced_at: new Date('2026-11-11T07:30:00Z') }] };
const never  = { rows: [{ last_synced_at: new Date(0) }] };

// ── parseYear ─────────────────────────────────────────────────────────────

describe('parseYear', () => {
  it('parses a valid year', () => {
    expect(parseYear('2026')).toBe(2026);
  });

  it.each(['26', '1999', '2101', '2026a', '', undefined, null, ['2026']])('rejects %j', (raw) => {
    expect(parseYear(raw)).toBeNull();
  });
});

// ── toTurnoverRow ─────────────────────────────────────────────────────────

describe('toTurnoverRow', () => {
  it('parses NUMERIC strings and derives open', () => {
    expect(toTurnoverRow({ invoiced: '2500.00', paid: '1500.00', invoice_count: '1' }))
      .toEqual({ invoiced: 2500, paid: 1500, open: 1000, invoice_count: 1 });
  });

  it('rounds to cents', () => {
    expect(toTurnoverRow({ invoiced: 10.005, paid: 3.333, invoice_count: 2 }).paid).toBe(3.33);
  });

  it('keeps invoiced = paid + open for float edge cases', () => {
    const r = toTurnoverRow({ invoiced: '0.3', paid: '0.1', invoice_count: 1 });
    expect(r.open).toBe(0.2);
    expect(round2(r.paid + r.open)).toBe(r.invoiced);
  });

  it('treats missing values as zero', () => {
    expect(toTurnoverRow({})).toEqual({ invoiced: 0, paid: 0, open: 0, invoice_count: 0 });
  });
});

const round2 = (n) => Math.round(n * 100) / 100;

// ── getProjectTurnover ────────────────────────────────────────────────────

describe('getProjectTurnover', () => {
  it('returns null for an unknown project', async () => {
    vi.mocked(query).mockResolvedValueOnce({ rows: [] });
    expect(await getProjectTurnover(999)).toBeNull();
  });

  it('returns years newest first with a total', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: 7, name: 'X' }] })
      .mockResolvedValueOnce({ rows: [
        { year: 2026, invoiced: '2500.00', paid: '1500.00', invoice_count: '1' },
        { year: 2025, invoiced: '1800.00', paid: '1800.00', invoice_count: '2' },
      ] })
      .mockResolvedValueOnce(synced);

    const t = await getProjectTurnover(7);

    expect(t.project).toEqual({ id: 7, name: 'X' });
    expect(t.years.map(y => y.year)).toEqual([2026, 2025]);
    expect(t.years[0]).toEqual({ year: 2026, invoiced: 2500, paid: 1500, open: 1000, invoice_count: 1 });
    expect(t.total).toEqual({ invoiced: 4300, paid: 3300, open: 1000, invoice_count: 3 });
    expect(t.last_synced_at).toBe('2026-11-11T07:30:00.000Z');
    expect(vi.mocked(query).mock.calls[1][0]).toContain('status_id IN (2, 3, 4)');
    expect(vi.mocked(query).mock.calls[1][1]).toEqual([7]);
  });

  it('returns no years and a zero total without invoices', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: 7, name: 'X' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(never);

    const t = await getProjectTurnover(7);

    expect(t.years).toEqual([]);
    expect(t.total).toEqual({ invoiced: 0, paid: 0, open: 0, invoice_count: 0 });
    expect(t.last_synced_at).toBeNull();
  });
});

// ── getYearTurnover ───────────────────────────────────────────────────────

describe('getYearTurnover', () => {
  it('lists projects in query order with a total and available years', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [
        { id: 7, name: 'A', invoiced: '2500.00', paid: '1500.00', invoice_count: '1' },
        { id: 3, name: 'B', invoiced: '900.50',  paid: '0.00',    invoice_count: '2' },
      ] })
      .mockResolvedValueOnce({ rows: [{ year: 2026 }, { year: '2025' }] })
      .mockResolvedValueOnce(synced);

    const t = await getYearTurnover(2026);

    expect(t.year).toBe(2026);
    expect(t.projects.map(p => p.id)).toEqual([7, 3]);
    expect(t.projects[1]).toEqual({ id: 3, name: 'B', invoiced: 900.5, paid: 0, open: 900.5, invoice_count: 2 });
    expect(t.total).toEqual({ invoiced: 3400.5, paid: 1500, open: 1900.5, invoice_count: 3 });
    expect(t.years_available).toEqual([2026, 2025]);
    expect(vi.mocked(query).mock.calls[0][0]).toContain('status_id IN (2, 3, 4)');
    expect(vi.mocked(query).mock.calls[0][1]).toEqual([2026]);
  });

  it('returns no projects and a zero total for a year without invoices', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce(never);

    const t = await getYearTurnover(2019);

    expect(t.projects).toEqual([]);
    expect(t.years_available).toEqual([]);
    expect(t.total.invoiced).toBe(0);
  });
});
