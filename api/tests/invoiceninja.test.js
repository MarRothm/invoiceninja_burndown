import { describe, it, expect } from 'vitest';
import { expandTimeEntries, mapInvoice } from '../src/services/invoiceninja.js';

describe('expandTimeEntries', () => {
  const baseTask = { id: 'task-1', project_id: 'proj-1' };

  it('returns empty array for null time_log', () => {
    expect(expandTimeEntries({ ...baseTask, time_log: null })).toEqual([]);
  });

  it('returns empty array for undefined time_log', () => {
    expect(expandTimeEntries({ ...baseTask })).toEqual([]);
  });

  it('returns empty array for malformed JSON string', () => {
    expect(expandTimeEntries({ ...baseTask, time_log: 'not-json' })).toEqual([]);
  });

  it('returns empty array for non-array value', () => {
    expect(expandTimeEntries({ ...baseTask, time_log: { foo: 1 } })).toEqual([]);
  });

  it('filters out incomplete entries (end = 0)', () => {
    const task = { ...baseTask, time_log: [[1700000000, 0]] };
    expect(expandTimeEntries(task)).toEqual([]);
  });

  it('filters out entries with negative end (invalid)', () => {
    const task = { ...baseTask, time_log: [[1700000000, -1]] };
    expect(expandTimeEntries(task)).toEqual([]);
  });

  it('filters out entries where end <= start (zero or negative duration)', () => {
    const task = { ...baseTask, time_log: [[1700003600, 1700003600]] }; // 0 h
    expect(expandTimeEntries(task)).toEqual([]);
  });

  it('correctly calculates hours from unix timestamps', () => {
    const start = 1700000000;
    const end   = start + 3600; // exactly 1 hour
    const task  = { ...baseTask, time_log: [[start, end]] };
    const [entry] = expandTimeEntries(task);
    expect(entry.hours).toBe(1);
  });

  it('rounds hours to 2 decimal places', () => {
    const start = 1700000000;
    const end   = start + 3700; // 1.0277... hours
    const task  = { ...baseTask, time_log: [[start, end]] };
    const [entry] = expandTimeEntries(task);
    expect(entry.hours).toBe(1.03);
  });

  it('assigns correct entry_date from start unix timestamp', () => {
    // 2023-11-14 22:13:20 UTC
    const start = 1700000000;
    const end   = start + 3600;
    const task  = { ...baseTask, time_log: [[start, end]] };
    const [entry] = expandTimeEntries(task);
    expect(entry.entry_date).toBe('2023-11-14');
  });

  it('sets status to "completed"', () => {
    const start = 1700000000;
    const end   = start + 7200;
    const task  = { ...baseTask, time_log: [[start, end]] };
    const [entry] = expandTimeEntries(task);
    expect(entry.status).toBe('completed');
  });

  it('preserves task id and project id on each entry', () => {
    const start = 1700000000;
    const end   = start + 3600;
    const task  = { id: 'my-task', project_id: 'my-proj', time_log: [[start, end]] };
    const [entry] = expandTimeEntries(task);
    expect(entry.invoiceninja_task_id).toBe('my-task');
    expect(entry.project_invoiceninja_id).toBe('my-proj');
  });

  it('handles multiple entries, skipping incomplete ones', () => {
    const start = 1700000000;
    const task = {
      ...baseTask,
      time_log: [
        [start,        start + 3600],  // 1h – complete
        [start + 7200, 0],             // incomplete – skip
        [start + 7200, start + 10800], // 1h – complete
      ],
    };
    const entries = expandTimeEntries(task);
    expect(entries).toHaveLength(2);
    expect(entries.every(e => e.hours === 1)).toBe(true);
  });

  it('parses time_log given as a JSON string', () => {
    const start = 1700000000;
    const end   = start + 3600;
    const task  = { ...baseTask, time_log: JSON.stringify([[start, end]]) };
    const [entry] = expandTimeEntries(task);
    expect(entry.hours).toBe(1);
  });

  it('skips entries that are not arrays', () => {
    const start = 1700000000;
    const end   = start + 3600;
    const task  = { ...baseTask, time_log: [null, [start, end], 'bad'] };
    const entries = expandTimeEntries(task);
    expect(entries).toHaveLength(1);
  });
});

describe('mapInvoice', () => {
  const inv = {
    id: 'inv-1', project_id: 'proj-1', number: '0042', date: '2026-02-10',
    amount: 2500, paid_to_date: 1500, status_id: '3', is_deleted: false,
  };

  it('maps a full invoice', () => {
    expect(mapInvoice(inv)).toEqual({
      invoiceninja_id: 'inv-1', invoiceninja_project_id: 'proj-1', number: '0042',
      invoice_date: '2026-02-10', amount: 2500, paid_to_date: 1500, status_id: 3, is_deleted: false,
    });
  });

  it('parses string status_id to a number', () => {
    expect(mapInvoice({ ...inv, status_id: '4' }).status_id).toBe(4);
  });

  it('defaults a missing status_id to draft', () => {
    expect(mapInvoice({ ...inv, status_id: undefined }).status_id).toBe(1);
  });

  it('turns empty date and project into null', () => {
    const row = mapInvoice({ ...inv, date: '', project_id: '' });
    expect(row.invoice_date).toBeNull();
    expect(row.invoiceninja_project_id).toBeNull();
  });

  it('parses numeric strings for amounts', () => {
    const row = mapInvoice({ ...inv, amount: '1234.56', paid_to_date: '100.10' });
    expect(row.amount).toBe(1234.56);
    expect(row.paid_to_date).toBe(100.1);
  });

  it('keeps is_deleted', () => {
    expect(mapInvoice({ ...inv, is_deleted: true }).is_deleted).toBe(true);
  });
});
