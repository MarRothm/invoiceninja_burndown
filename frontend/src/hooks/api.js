const BASE = import.meta.env.VITE_API_URL ?? '/api';

export async function fetchProjects() {
  const res = await fetch(`${BASE}/projects`);
  if (!res.ok) throw new Error('Failed to fetch projects');
  const json = await res.json();
  return json.data;
}

export async function fetchBurndown(projectId) {
  const res = await fetch(`${BASE}/projects/${projectId}/burndown`);
  if (!res.ok) throw new Error('Failed to fetch burndown');
  return res.json();
}

export async function triggerSync() {
  const res = await fetch(`${BASE}/sync`, { method: 'POST' });
  if (!res.ok) throw new Error('Sync failed');
  return res.json();
}
