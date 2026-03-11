import { query, getClient } from '../db/pool.js';
import { fetchProjects, fetchTasks, expandTimeEntries } from './invoiceninja.js';

async function getLastSynced(resource) {
  const res = await query('SELECT last_synced_at FROM sync_state WHERE resource = $1', [resource]);
  return res.rows[0]?.last_synced_at ?? null;
}

async function setLastSynced(resource, ts) {
  await query(
    'UPDATE sync_state SET last_synced_at = $1 WHERE resource = $2',
    [ts, resource]
  );
}

export async function syncProjects() {
  const since = await getLastSynced('projects');
  const now   = new Date().toISOString();
  console.log(`[sync] projects since ${since ?? 'beginning'}`);

  const projects = await fetchProjects(since);
  console.log(`[sync] ${projects.length} projects fetched`);

  for (const p of projects) {
    const archivedAt    = p.archived_at ? new Date(p.archived_at * 1000).toISOString() : null;
    // custom_value2 = tatsächliches Projektende (YYYY-MM-DD), z.B. bei Abbruch
    const actualEndDate = p.custom_value2?.trim() || null;
    await query(`
      INSERT INTO projects (invoiceninja_id, name, budgeted_hours, deadline, start_date, archived_at, actual_end_date, raw, synced_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (invoiceninja_id) DO UPDATE SET
        name            = EXCLUDED.name,
        budgeted_hours  = EXCLUDED.budgeted_hours,
        deadline        = EXCLUDED.deadline,
        start_date      = EXCLUDED.start_date,
        archived_at     = EXCLUDED.archived_at,
        actual_end_date = EXCLUDED.actual_end_date,
        raw             = EXCLUDED.raw,
        synced_at       = NOW(),
        updated_at      = NOW()
    `, [
      p.id,
      p.name,
      parseFloat(p.budgeted_hours) || 0,
      p.due_date || null,
      p.created_at ? new Date(p.created_at * 1000).toISOString().slice(0, 10) : null,
      archivedAt,
      actualEndDate,
      JSON.stringify(p),
    ]);
  }

  await setLastSynced('projects', now);
  return projects.length;
}

export async function syncTimeEntries() {
  const since = await getLastSynced('time_entries');
  const now   = new Date().toISOString();
  console.log(`[sync] time_entries since ${since ?? 'beginning'}`);

  const tasks = await fetchTasks(since);
  console.log(`[sync] ${tasks.length} tasks fetched`);

  let count = 0;
  for (const task of tasks) {
    if (!task.project_id) continue;

    // Resolve internal project id
    const projRes = await query(
      'SELECT id FROM projects WHERE invoiceninja_id = $1',
      [task.project_id]
    );
    if (!projRes.rows.length) continue;
    const projectId = projRes.rows[0].id;

    const entries = expandTimeEntries(task);

    // Delete existing entries for this task and re-insert (handles corrections)
    await query('DELETE FROM time_entries WHERE invoiceninja_task_id = $1', [task.id]);

    for (const e of entries) {
      await query(`
        INSERT INTO time_entries
          (invoiceninja_task_id, project_id, hours, entry_date, status, synced_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      `, [task.id, projectId, e.hours, e.entry_date, e.status]);
      count++;
    }
  }

  await setLastSynced('time_entries', now);
  return count;
}

export async function runFullSync() {
  const t0 = Date.now();
  try {
    const projects = await syncProjects();
    const entries  = await syncTimeEntries();
    console.log(`[sync] done in ${Date.now() - t0}ms — ${projects} projects, ${entries} entries`);
    return { projects, entries, ms: Date.now() - t0 };
  } catch (err) {
    console.error('[sync] error:', err.message);
    throw err;
  }
}
