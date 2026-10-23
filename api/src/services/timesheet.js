import { query } from '../db/pool.js';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

const DAY_MS = 86400000;

const round2 = (n) => Math.round(n * 100) / 100;

const toISODate = (ms) => new Date(ms).toISOString().slice(0, 10);

/** ISO weekday of a UTC timestamp: Monday = 1 … Sunday = 7 */
const isoWeekday = (ms) => new Date(ms).getUTCDay() || 7;

/** Lookup date → hours from grouped query rows */
function hoursLookup(rows) {
  const hoursByDate = {};
  for (const row of rows) {
    hoursByDate[row.date] = parseFloat(row.hours) || 0;
  }
  return hoursByDate;
}

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
 * Hour rate from the synced InvoiceNinja `task_rate` (sent as 0 when unset).
 * Returns a positive number, or null if missing, 0 or not numeric.
 */
export function parseRate(value) {
  const rate = parseFloat(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** EUR amount of unrounded `hours` at `rate`, rounded to cents; null without a rate. */
export function amountFor(hours, rate) {
  return rate === null ? null : round2(hours * rate);
}

/**
 * Build one entry per calendar day of `month` ('YYYY-MM').
 * rows: [ { date: 'YYYY-MM-DD', hours } ] – days without a row get 0 hours.
 * Returns [ { date, weekday (ISO 1–7, Monday = 1), hours } ]
 */
export function buildMonthDays(month, rows) {
  const { year, month: mon } = parseMonth(month);

  const hoursByDate = hoursLookup(rows);

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
 * Half-open date range [from, to) covering every Monday–Sunday week that touches `month`.
 * from = Monday on/before the 1st, to = Monday after the Sunday on/after the last day.
 */
export function weekRange(month) {
  const { year, month: mon } = parseMonth(month);
  const first = Date.UTC(year, mon - 1, 1);
  const last  = Date.UTC(year, mon, 0);
  return {
    from: toISODate(first - (isoWeekday(first) - 1) * DAY_MS),
    to:   toISODate(last + (8 - isoWeekday(last)) * DAY_MS),
  };
}

/**
 * ISO 8601 week number and week-year of a 'YYYY-MM-DD' date (week containing Thursday).
 */
export function isoWeek(date) {
  const ms       = Date.parse(`${date}T00:00:00Z`);
  const thursday = new Date(ms + (4 - isoWeekday(ms)) * DAY_MS);
  const year     = thursday.getUTCFullYear();
  const week     = Math.floor((thursday - Date.UTC(year, 0, 1)) / (7 * DAY_MS)) + 1;
  return { week, year };
}

/**
 * Weekly subtotals for every Monday–Sunday week touching `month`, including
 * neighbouring-month days (flagged in_month: false). amount is the week in EUR at `rate` (null without one).
 * Returns [ { week, year, start, end, hours, amount, spans_other_month, days: [ { date, weekday, hours, in_month } ] } ]
 */
export function buildWeeks(month, rows, rate = null) {
  const { from, to } = weekRange(month);
  const hoursByDate  = hoursLookup(rows);
  const end          = Date.parse(`${to}T00:00:00Z`);

  const weeks = [];
  for (let monday = Date.parse(`${from}T00:00:00Z`); monday < end; monday += 7 * DAY_MS) {
    const days = [];
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const date  = toISODate(monday + i * DAY_MS);
      const hours = hoursByDate[date] ?? 0;
      sum += hours;
      days.push({ date, weekday: i + 1, hours: round2(hours), in_month: date.startsWith(month) });
    }
    weeks.push({
      ...isoWeek(days[0].date),
      start:             days[0].date,
      end:               days[6].date,
      hours:             round2(sum),
      amount:            amountFor(sum, rate),
      spans_other_month: days.some(d => !d.in_month),
      days,
    });
  }
  return weeks;
}

/**
 * Daily totals of completed time entries for one project and month.
 * days and total cover the month only; weeks cover full Monday–Sunday weeks touching it.
 * rate is the project's InvoiceNinja task rate (null if unset); amount is total in EUR.
 * Returns { project, month, days, total, rate, amount, weeks, last_synced_at } or null if the project does not exist.
 */
export async function getTimesheet(projectId, month) {
  const { from, to } = weekRange(month);

  const projRes = await query(
    "SELECT id, name, raw->>'task_rate' AS task_rate FROM projects WHERE id = $1",
    [projectId]
  );
  if (!projRes.rows.length) return null;
  const project = projRes.rows[0];
  const rate    = parseRate(project.task_rate);

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

  const days       = buildMonthDays(month, entriesRes.rows);
  const monthHours = entriesRes.rows
    .filter(r => r.date.startsWith(month))
    .reduce((sum, r) => sum + (parseFloat(r.hours) || 0), 0);

  return {
    project:        { id: project.id, name: project.name },
    month,
    days,
    total:          round2(monthHours),
    rate,
    amount:         amountFor(monthHours, rate),
    weeks:          buildWeeks(month, entriesRes.rows, rate),
    last_synced_at: neverSynced ? null : new Date(lastSynced).toISOString(),
  };
}
