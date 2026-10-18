import { query } from '../db/pool.js';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Validate a 'YYYY-MM' string (years 2000–2100).
 * Returns { year, month, from, to } with ISO dates for [first day, first day of next month), or null.
 */
export function parseMonth(raw) {
  if (typeof raw !== 'string') return null;
  const m = MONTH_RE.exec(raw);
  if (!m) return null;
  const year  = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (year < 2000 || year > 2100) return null;

  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10);
  const to   = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  return { year, month, from, to };
}

/**
 * Build one entry per calendar day of `month` ('YYYY-MM').
 * rows: [ { date: 'YYYY-MM-DD', hours } ] – days without a row get 0 hours.
 * Returns [ { date, weekday (ISO 1–7, Monday = 1), hours } ]
 */
export function buildMonthDays(month, rows) {
  const { year, month: mon } = parseMonth(month);

  const hoursByDate = {};
  for (const row of rows) {
    hoursByDate[row.date] = parseFloat(row.hours) || 0;
  }

  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const cur  = new Date(Date.UTC(year, mon - 1, d));
    const date = cur.toISOString().slice(0, 10);
    days.push({
      date,
      weekday: cur.getUTCDay() || 7,
      hours:   round2(hoursByDate[date] ?? 0),
    });
  }
  return days;
}

/**
 * Daily totals of completed time entries for one project and month.
 * Returns { project, month, days, total, last_synced_at } or null if the project does not exist.
 */
export async function getTimesheet(projectId, month) {
  const { from, to } = parseMonth(month);

  const projRes = await query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
  if (!projRes.rows.length) return null;
  const project = projRes.rows[0];

  const entriesRes = await query(`
    SELECT entry_date::text AS date, SUM(hours) AS hours
    FROM time_entries
    WHERE project_id = $1
      AND status = 'completed'
      AND entry_date >= $2::date
      AND entry_date <  $3::date
    GROUP BY entry_date
  `, [projectId, from, to]);

  const syncRes = await query(
    'SELECT last_synced_at FROM sync_state WHERE resource = $1',
    ['time_entries']
  );
  const lastSynced = syncRes.rows[0]?.last_synced_at ?? null;
  // sync_state defaults to the epoch until the first sync has run
  const neverSynced = !lastSynced || new Date(lastSynced).getTime() <= 0;

  const days  = buildMonthDays(month, entriesRes.rows);
  const total = round2(entriesRes.rows.reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0));

  return {
    project:        { id: project.id, name: project.name },
    month,
    days,
    total,
    last_synced_at: neverSynced ? null : new Date(lastSynced).toISOString(),
  };
}
