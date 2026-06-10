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

export async function fetchAIStatus() {
  const res = await fetch(`${BASE}/ai-dashboard/status`);
  if (!res.ok) return { ollama: 'unavailable', model: 'qwen2.5:7b', cached: false };
  return res.json();
}

export async function fetchAIDashboardConfig() {
  try {
    const res = await fetch(`${BASE}/ai-dashboard/config`);
    if (!res.ok) return { thresholds: { atRisk: 80, overBudget: 100 } };
    return res.json();
  } catch {
    return { thresholds: { atRisk: 80, overBudget: 100 } };
  }
}

export function fetchAIDashboard({ onToken, onCached, onDone, onError }) {
  const source = new EventSource(`${BASE}/ai-dashboard`);
  // T046: track whether [DONE] was received so onerror can distinguish normal
  // close (after sentinel) from a genuine connection drop mid-stream.
  let doneSeen = false;

  source.onmessage = (e) => {
    const data = e.data;
    if (data === '[DONE]') {
      doneSeen = true;
      source.close();
      onDone?.();
      return;
    }
    // Cached payload: single JSON event with full layout
    if (data.startsWith('{"cached":true')) {
      try {
        const { layout } = JSON.parse(data);
        onCached?.(layout);
      } catch { /* ignore */ }
      return;
    }
    // Error payload
    if (data.startsWith('{"error"')) {
      try {
        const parsed = JSON.parse(data);
        onError?.(new Error(parsed.error));
      } catch { /* ignore */ }
      return;
    }
    onToken?.(data);
  };

  source.onerror = () => {
    source.close();
    // T046: only surface an error if [DONE] was never received — a connection close
    // after the sentinel is normal and must not overwrite the ready state.
    if (!doneSeen) {
      onError?.(new Error('Generation incomplete — connection lost'));
    }
  };

  return () => {
    doneSeen = true; // T046: suppress spurious onerror after caller-initiated close
    source.close();
  };
}
