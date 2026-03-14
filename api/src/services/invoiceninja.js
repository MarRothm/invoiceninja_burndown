const BASE_URL = process.env.INVOICENINJA_URL?.replace(/\/$/, '');
const API_KEY  = process.env.INVOICENINJA_API_KEY;

async function apiFetch(path, params = {}) {
  const url = new URL(`${BASE_URL}/api/v1${path}`);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      'X-Api-Token': API_KEY,
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    },
  });

  if (!res.ok) throw new Error(`InvoiceNinja API error: ${res.status} ${url}`);
  return res.json();
}

/**
 * Fetch all projects updated after a given ISO timestamp.
 */
export async function fetchProjects(updatedAfter) {
  const params = { updated_at: updatedAfter ? Math.floor(new Date(updatedAfter).getTime() / 1000) : undefined };
  const data = await apiFetch('/projects', params);
  return data.data ?? [];
}

/**
 * Fetch all tasks (time entries) updated after a given ISO timestamp.
 * Handles pagination automatically to avoid the 500-record cap.
 */
export async function fetchTasks(updatedAfter) {
  const perPage = 500;
  const baseParams = {
    updated_at: updatedAfter ? Math.floor(new Date(updatedAfter).getTime() / 1000) : undefined,
    per_page: perPage,
  };

  const all = [];
  let page = 1;

  while (true) {
    const data = await apiFetch('/tasks', { ...baseParams, page });
    const records = data.data ?? [];
    all.push(...records);

    // Stop when we got fewer records than the page size (last page)
    if (records.length < perPage) break;
    page++;
  }

  return all;
}

/**
 * Expand InvoiceNinja task time_log into individual time entry records.
 * time_log is an array of [start_unix, end_unix] pairs.
 * Only entries where end > 0 (completed) and hours > 0 are included.
 */
export function expandTimeEntries(task) {
  if (!task.time_log) return [];

  let logs;
  try {
    logs = typeof task.time_log === 'string' ? JSON.parse(task.time_log) : task.time_log;
  } catch {
    return [];
  }

  if (!Array.isArray(logs)) return [];

  return logs
    .filter((entry) => Array.isArray(entry) && entry.length >= 2)
    .filter(([, end]) => end > 0)              // only completed (end timestamp set)
    .map(([start, end]) => {
      const hours = (end - start) / 3600;
      const date  = new Date(start * 1000).toISOString().slice(0, 10);
      return {
        invoiceninja_task_id: task.id,
        project_invoiceninja_id: task.project_id,
        hours: Math.round(hours * 100) / 100,
        entry_date: date,
        status: 'completed',
      };
    })
    .filter((e) => e.hours > 0);              // discard zero/negative durations
}
