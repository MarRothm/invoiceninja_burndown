import { query } from '../db/pool.js';

const YEAR_RE = /^\d{4}$/;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Counted invoices of visible projects, for `invoices i JOIN projects p ON p.id = i.project_id`:
 * dated, not deleted, status sent (2) / partial (3) / paid (4); project not deleted or archived.
 * Shared by the per-project table and the year overview so both show identical amounts.
 */
const COUNTED = `
  i.project_id IS NOT NULL
  AND i.invoice_date IS NOT NULL
  AND NOT i.is_deleted
  AND i.status_id IN (2, 3, 4)
  AND NOT COALESCE((p.raw->>'is_deleted')::boolean, false)
  AND p.archived_at IS NULL
`;

/**
 * Validate a 'YYYY' string (years 2000–2100). Returns the year as a number, or null.
 */
export function parseYear(raw) {
  if (typeof raw !== 'string' || !YEAR_RE.test(raw)) return null;
  const year = parseInt(raw, 10);
  return year >= 2000 && year <= 2100 ? year : null;
}

/**
 * Gross amounts from summed NUMERIC strings, rounded to cents; open = invoiced − paid.
 * Returns { invoiced, paid, open, invoice_count }
 */
export function toTurnoverRow({ invoiced, paid, invoice_count }) {
  const inv = parseFloat(invoiced) || 0;
  const pd  = parseFloat(paid) || 0;
  return {
    invoiced:      round2(inv),
    paid:          round2(pd),
    open:          round2(inv - pd),
    invoice_count: parseInt(invoice_count, 10) || 0,
  };
}

/** Total over unrounded row sums. */
function totalOf(rows) {
  return toTurnoverRow(rows.reduce((acc, r) => ({
    invoiced:      acc.invoiced + (parseFloat(r.invoiced) || 0),
    paid:          acc.paid + (parseFloat(r.paid) || 0),
    invoice_count: acc.invoice_count + (parseInt(r.invoice_count, 10) || 0),
  }), { invoiced: 0, paid: 0, invoice_count: 0 }));
}

/** Last invoice sync as ISO string, or null if never synced (sync_state defaults to the epoch). */
async function lastSynced() {
  const res = await query('SELECT last_synced_at FROM sync_state WHERE resource = $1', ['invoices']);
  const ts  = res.rows[0]?.last_synced_at ?? null;
  return !ts || new Date(ts).getTime() <= 0 ? null : new Date(ts).toISOString();
}

/**
 * Invoiced / paid / open per invoice year for one project, newest first.
 * Returns { project, years, total, last_synced_at } or null if the project does not exist.
 */
export async function getProjectTurnover(projectId) {
  const projRes = await query('SELECT id, name FROM projects WHERE id = $1', [projectId]);
  if (!projRes.rows.length) return null;
  const project = projRes.rows[0];

  const res = await query(`
    SELECT EXTRACT(YEAR FROM i.invoice_date)::int AS year,
           SUM(i.amount)       AS invoiced,
           SUM(i.paid_to_date) AS paid,
           COUNT(*)            AS invoice_count
    FROM invoices i
    JOIN projects p ON p.id = i.project_id
    WHERE p.id = $1 AND ${COUNTED}
    GROUP BY 1
    ORDER BY 1 DESC
  `, [projectId]);

  return {
    project:        { id: project.id, name: project.name },
    years:          res.rows.map(r => ({ year: r.year, ...toTurnoverRow(r) })),
    total:          totalOf(res.rows),
    last_synced_at: await lastSynced(),
  };
}

/**
 * Invoiced / paid / open per visible project for one invoice year, highest invoiced first.
 * Returns { year, years_available, projects, total, last_synced_at }
 */
export async function getYearTurnover(year) {
  const res = await query(`
    SELECT p.id, p.name,
           SUM(i.amount)       AS invoiced,
           SUM(i.paid_to_date) AS paid,
           COUNT(*)            AS invoice_count
    FROM invoices i
    JOIN projects p ON p.id = i.project_id
    WHERE ${COUNTED} AND EXTRACT(YEAR FROM i.invoice_date) = $1
    GROUP BY p.id, p.name
    ORDER BY SUM(i.amount) DESC, p.name ASC
  `, [year]);

  const yearsRes = await query(`
    SELECT DISTINCT EXTRACT(YEAR FROM i.invoice_date)::int AS year
    FROM invoices i
    JOIN projects p ON p.id = i.project_id
    WHERE ${COUNTED}
    ORDER BY 1 DESC
  `);

  return {
    year,
    years_available: yearsRes.rows.map(r => Number(r.year)),
    projects:        res.rows.map(r => ({ id: r.id, name: r.name, ...toTurnoverRow(r) })),
    total:           totalOf(res.rows),
    last_synced_at:  await lastSynced(),
  };
}
