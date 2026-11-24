import React, { useState, useEffect } from 'react';
import { fetchTurnover } from '../../hooks/api.js';
import {
  cardStyle, retryButton, TurnoverHead, AmountCells, totalRowStyle, TurnoverFooter,
} from '../ProjectTurnover.jsx';

// The year is resolved at render time when omitted, so a cached layout never goes stale.
function resolveYear(year) {
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();
}

// AI block: cross-project turnover (invoiced / paid / open) for one year. Read-only.
export default function TurnoverOverviewAI({ props: { year } }) {
  const y = resolveYear(year);
  const [data,   setData]   = useState(null);
  const [status, setStatus] = useState('loading');
  const [error,  setError]  = useState(null);
  const [retry,  setRetry]  = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fetchTurnover(y)
      .then(d  => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(e => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [y, retry]);

  return (
    <div style={{ ...cardStyle, marginBottom: 16 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>TURNOVER {y}</div>

      {status === 'loading' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading...</div>}

      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>
          {error} <button onClick={() => setRetry(k => k + 1)} style={{ ...retryButton, marginLeft: 8 }}>Retry</button>
        </div>
      )}

      {status === 'ready' && data.projects.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>No invoices in {y}</div>
      )}

      {status === 'ready' && data.projects.length > 0 && (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TurnoverHead label="Project" />
            <tbody>
              {data.projects.map(p => (
                <tr key={p.id}>
                  <td style={{ padding: '6px 0', fontWeight: 600 }}>{p.name}</td>
                  <AmountCells row={p} />
                </tr>
              ))}
              <tr style={totalRowStyle}>
                <td style={{ padding: '6px 0', fontWeight: 700 }}>Total</td>
                <AmountCells row={data.total} bold />
              </tr>
            </tbody>
          </table>
          <TurnoverFooter lastSyncedAt={data.last_synced_at} />
        </>
      )}
    </div>
  );
}
