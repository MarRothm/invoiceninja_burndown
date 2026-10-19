import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/pool.js', () => ({ query: vi.fn() }));

import { query } from '../src/db/pool.js';
import {
  buildMonthDays, buildWeeks, getTimesheet, isoWeek, parseMonth, weekRange,
} from '../src/services/timesheet.js';

// ── parseMonth ────────────────────────────────────────────────────────────

describe('parseMonth', () => {
  it('parses a valid month', () => {
    expect(parseMonth('2026-09')).toEqual({ year: 2026, month: 9, from: '2026-09-01', to: '2026-10-01' });
  });

  it('rolls over to the next year for December', () => {
    expect(parseMonth('2026-12').to).toBe('2027-01-01');
  });

  it.each(['2026-13', '2026-00', '2026-1', 'abcd-ef', '1999-12', '2101-01', '2026-09-01', '', undefined, null, ['2026-09']])(
    'rejects %j',
    (raw) => {
      expect(parseMonth(raw)).toBeNull();
    }
  );
});

// ── buildMonthDays ────────────────────────────────────────────────────────

describe('buildMonthDays', () => {
  it.each([
    ['2026-02', 28],
    ['2028-02', 29],
    ['2026-09', 30],
    ['2026-10', 31],
  ])('returns one entry per day for %s', (month, count) => {
    const days = buildMonthDays(month, []);
    expect(days).toHaveLength(count);
    expect(days[0].date).toBe(`${month}-01`);
    expect(days[count - 1].date).toBe(`${month}-${count}`);
  });

  it('fills days without bookings with 0 hours', () => {
    const days = buildMonthDays('2026-09', [{ date: '2026-09-03', hours: '4.00' }]);
    expect(days.find(d => d.date === '2026-09-02').hours).toBe(0);
    expect(days.find(d => d.date === '2026-09-03').hours).toBe(4);
  });

  it('uses ISO weekdays (Monday = 1, Sunday = 7)', () => {
    const days = buildMonthDays('2026-09', []);
    expect(days.find(d => d.date === '2026-09-01').weekday).toBe(2); // Tuesday
    expect(days.find(d => d.date === '2026-09-06').weekday).toBe(7); // Sunday
    expect(days.find(d => d.date === '2026-09-07').weekday).toBe(1); // Monday
  });

  it('parses string hours and rounds to 2 decimals', () => {
    const days = buildMonthDays('2026-09', [
      { date: '2026-09-01', hours: '1.50' },
      { date: '2026-09-02', hours: 0.333333 },
    ]);
    expect(days[0].hours).toBe(1.5);
    expect(days[1].hours).toBe(0.33);
  });

  it('ignores rows outside the month', () => {
    const days = buildMonthDays('2026-09', [{ date: '2026-10-01', hours: '8' }]);
    expect(days.every(d => d.hours === 0)).toBe(true);
  });
});

// ── weekRange / isoWeek ───────────────────────────────────────────────────

describe('weekRange', () => {
  it.each([
    ['2026-09', '2026-08-31', '2026-10-05'],
    ['2026-08', '2026-07-27', '2026-09-07'],
    ['2021-02', '2021-02-01', '2021-03-01'],
  ])('covers full Monday–Sunday weeks for %s', (month, from, to) => {
    expect(weekRange(month)).toEqual({ from, to });
  });
});

describe('isoWeek', () => {
  it.each([
    ['2026-08-31', 36, 2026],
    ['2026-12-28', 53, 2026],
    ['2025-12-29', 1, 2026],
    ['2021-01-03', 53, 2020],
  ])('%s → week %i of %i', (date, week, year) => {
    expect(isoWeek(date)).toEqual({ week, year });
  });
});

// ── buildWeeks ────────────────────────────────────────────────────────────

describe('buildWeeks', () => {
  it('returns full Monday–Sunday weeks touching the month', () => {
    const weeks = buildWeeks('2026-09', []);
    expect(weeks).toHaveLength(5);
    expect(weeks[0].start).toBe('2026-08-31');
    expect(weeks[4].end).toBe('2026-10-04');
    expect(weeks.map(w => w.week)).toEqual([36, 37, 38, 39, 40]);
    for (const w of weeks) {
      expect(w.days).toHaveLength(7);
      expect(w.days.map(d => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it.each([['2026-08', 6], ['2021-02', 4]])('%s spans %i weeks', (month, count) => {
    expect(buildWeeks(month, [])).toHaveLength(count);
  });

  it('marks no week as spanning another month when the month fills whole weeks', () => {
    expect(buildWeeks('2021-02', []).every(w => !w.spans_other_month)).toBe(true);
  });

  it('includes neighbouring-month days in edge-week subtotals', () => {
    const weeks = buildWeeks('2026-09', [
      { date: '2026-09-29', hours: '2' },
      { date: '2026-10-02', hours: '3' },
    ]);
    const last = weeks[4];
    expect(last.hours).toBe(5);
    expect(last.spans_other_month).toBe(true);
    expect(last.days.filter(d => !d.in_month).map(d => d.date))
      .toEqual(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
    expect(weeks[1].spans_other_month).toBe(false);
  });

  it('rounds week hours to 2 decimals', () => {
    const weeks = buildWeeks('2026-09', [
      { date: '2026-09-07', hours: 0.333 },
      { date: '2026-09-08', hours: 0.333 },
    ]);
    expect(weeks[1].hours).toBe(0.67);
  });

  it('lists every date in exactly one week', () => {
    const dates = buildWeeks('2026-08', []).flatMap(w => w.days.map(d => d.date));
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates[0]).toBe('2026-07-27');
    expect(dates.at(-1)).toBe('2026-09-06');
  });
});

// ── getTimesheet ──────────────────────────────────────────────────────────

describe('getTimesheet', () => {
  it('queries full weeks but keeps days and total month-only', async () => {
    vi.mocked(query)
      .mockResolvedValueOnce({ rows: [{ id: 7, name: 'X' }] })
      .mockResolvedValueOnce({ rows: [
        { date: '2026-08-31', hours: '1.00' },
        { date: '2026-09-03', hours: '4.00' },
        { date: '2026-10-02', hours: '3.00' },
      ] })
      .mockResolvedValueOnce({ rows: [{ last_synced_at: new Date('2026-10-18T07:30:00Z') }] });

    const t = await getTimesheet(7, '2026-09');

    expect(vi.mocked(query).mock.calls[1][1]).toEqual([7, '2026-08-31', '2026-10-05']);
    expect(t.days).toHaveLength(30);
    expect(t.total).toBe(4);
    expect(t.weeks[0].hours).toBe(5);
    expect(t.weeks[4].hours).toBe(3);
    expect(t.last_synced_at).toBe('2026-10-18T07:30:00.000Z');
  });
});
