import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/db/pool.js', () => ({ query: vi.fn() }));

import { buildMonthDays, parseMonth } from '../src/services/timesheet.js';

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
