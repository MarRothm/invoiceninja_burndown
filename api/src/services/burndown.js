import { query } from '../db/pool.js';

/**
 * Generate an array of dates between start and end (inclusive).
 */
function dateRange(start, end) {
  const dates = [];
  const cur = new Date(start);
  const fin = new Date(end);
  while (cur <= fin) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/**
 * Calculate burndown data for a single project.
 * Returns { project, burndown: [ { date, ideal, actual, logged } ] }
 */
export async function getBurndown(projectId) {
  const projRes = await query(
    'SELECT * FROM projects WHERE id = $1',
    [projectId]
  );
  if (!projRes.rows.length) return null;
  const project = projRes.rows[0];

  const budgeted = parseFloat(project.budgeted_hours) || 0;

  const today = new Date().toISOString().slice(0, 10);

  // Fetch all completed time entries for this project, summed per day
  const entriesRes = await query(`
    SELECT entry_date::text AS date, SUM(hours) AS hours
    FROM time_entries
    WHERE project_id = $1 AND status = 'completed'
    GROUP BY entry_date
    ORDER BY entry_date ASC
  `, [projectId]);

  // Determine date range
  // start = first booking (fallback: project.start_date or updated_at)
  // end   = last booking or today (whichever is later), capped at deadline if set
  const firstEntryDate = entriesRes.rows.length > 0 ? entriesRes.rows[0].date : null;

  const startDate = firstEntryDate
    ? new Date(firstEntryDate)
    : project.start_date
      ? new Date(project.start_date)
      : new Date(project.updated_at);

  // chartEndDate: where the chart stops (actual_end_date if cancelled, else deadline or today)
  // planEndDate:  original planned end for the ideal line slope (always deadline or today)
  const chartEndDate = project.actual_end_date
    ? new Date(project.actual_end_date)
    : project.deadline
      ? new Date(project.deadline)
      : new Date();

  const planEndDate = project.deadline
    ? new Date(project.deadline)
    : chartEndDate;

  // Build lookup: date → logged hours that day
  const loggedByDate = {};
  for (const row of entriesRes.rows) {
    loggedByDate[row.date] = parseFloat(row.hours);
  }

  // Build burndown series
  // totalDays based on original plan (startDate → planEndDate) so ideal slope is unaffected by cancellation
  const startStr   = startDate.toISOString().slice(0, 10);
  const planDays   = Math.max(
    Math.round((planEndDate - startDate) / 86400000),
    1
  );
  const dates    = dateRange(startStr, chartEndDate.toISOString().slice(0, 10));
  const burndown = [];
  let cumulativeLogged = 0;

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];
    cumulativeLogged += loggedByDate[date] ?? 0;

    const ideal  = Math.max(budgeted - (budgeted / planDays) * i, 0);
    const actual = date <= today
      ? Math.max(budgeted - cumulativeLogged, 0)
      : null;   // future dates: no actual line

    burndown.push({
      date,
      ideal:    Math.round(ideal * 100) / 100,
      actual:   actual !== null ? Math.round(actual * 100) / 100 : null,
      logged:   Math.round((loggedByDate[date] ?? 0) * 100) / 100,
      forecast: null,
    });
  }

  // Summary stats
  const deadlineStr = project.deadline ? new Date(project.deadline).toISOString().slice(0, 10) : null;
  const isClosed    = !!project.actual_end_date || (!!deadlineStr && deadlineStr <= today);
  const totalLogged = Object.values(loggedByDate).reduce((a, b) => a + b, 0);
  const remaining   = isClosed ? 0 : Math.max(budgeted - totalLogged, 0);
  const progress    = budgeted > 0 ? Math.round((totalLogged / budgeted) * 100) : 0;

  // Forecast: verlängert die Ist-Linie linear in die Zukunft (nur für offene Projekte)
  if (!isClosed) {
    let lastActualIdx = -1;
    for (let i = burndown.length - 1; i >= 0; i--) {
      if (burndown[i].actual !== null) { lastActualIdx = i; break; }
    }
    if (lastActualIdx > 0) {
      const lastActual  = burndown[lastActualIdx].actual;
      const dailyRate   = (budgeted - lastActual) / lastActualIdx; // Ø Stunden/Tag verbraucht
      burndown[lastActualIdx].forecast = lastActual;               // Ankerpunkt = heute
      for (let i = lastActualIdx + 1; i < burndown.length; i++) {
        burndown[i].forecast = Math.max(
          Math.round((lastActual - dailyRate * (i - lastActualIdx)) * 100) / 100,
          0
        );
      }
    }
  }

  return {
    project: {
      id:              project.id,
      name:            project.name,
      budgeted_hours:  budgeted,
      deadline:        project.deadline,
      actual_end_date: project.actual_end_date ?? null,
      start_date:      project.start_date,
      status:          isClosed ? 'closed' : 'in_progress',
    },
    stats: {
      total_logged: Math.round(totalLogged * 100) / 100,
      remaining:    Math.round(remaining * 100) / 100,
      progress,
    },
    burndown,
  };
}

/**
 * List all projects with quick summary stats.
 */
export async function listProjectsWithStats() {
  const res = await query(`
    SELECT
      p.id,
      p.invoiceninja_id,
      p.name,
      p.budgeted_hours,
      p.deadline,
      p.actual_end_date,
      p.start_date,
      COALESCE(SUM(te.hours) FILTER (WHERE te.status = 'completed'), 0) AS total_logged
    FROM projects p
    LEFT JOIN time_entries te ON te.project_id = p.id
    GROUP BY p.id
    ORDER BY
      CASE WHEN p.actual_end_date IS NOT NULL OR (p.deadline IS NOT NULL AND p.deadline <= CURRENT_DATE) THEN 1 ELSE 0 END ASC,
      p.start_date DESC NULLS LAST
  `);

  const today = new Date().toISOString().slice(0, 10);
  return res.rows.map(r => {
    const deadlineStr = r.deadline ? new Date(r.deadline).toISOString().slice(0, 10) : null;
    const isClosed    = !!r.actual_end_date || (!!deadlineStr && deadlineStr <= today);
    const budgeted    = parseFloat(r.budgeted_hours);
    const totalLogged = parseFloat(r.total_logged);
    return {
      ...r,
      budgeted_hours:  budgeted,
      total_logged:    totalLogged,
      remaining:       isClosed ? 0 : Math.max(budgeted - totalLogged, 0),
      progress:        budgeted > 0 ? Math.round((totalLogged / budgeted) * 100) : 0,
      status:          isClosed ? 'closed' : 'in_progress',
    };
  });
}
