import React, { useState, useEffect } from 'react';
import { fetchTurnover } from '../hooks/api.js';
import {
  AmountCells, TurnoverFooter, TurnoverHead, cardStyle, retryButton, totalRowStyle,
} from './ProjectTurnover.jsx';

const navButton = (disabled) => ({
  padding:      '2px 8px',
  background:   'transparent',
  border:       '1px solid var(--border)',
  borderRadius: 4,
  color:        disabled ? 'var(--muted)' : 'var(--text)',
  fontSize:     13,
  cursor:       disabled ? 'not-allowed' : 'pointer',
  opacity:      disabled ? 0.5 : 1,
});

export default function TurnoverOverview({ reloadKey, onSelectProject }) {
  const currentYear = new Date().getFullYear();
  const [year,    setYear]    = useState(currentYear);
  const [data,    setData]    = useState(null);
  const [status,  setStatus]  = useState('loading');
  const [error,   setError]   = useState(null);
  const [retry,   setRetry]   = useState(0);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fetchTurnover(year)
      .then(d  => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(e => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [year, reloadKey, retry]);

  // Selectable years: every year with invoices plus the current year, ascending
  const years = [...new Set([...(data?.years_available ?? []), currentYear, year])].sort((a, b) => a - b);
  const idx   = years.indexOf(year);
  const ready = status === 'ready' && data;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, flex: 1 }}>Turnover</h1>
        <button onClick={() => setYear(years[idx - 1])} disabled={idx <= 0} aria-label="Previous year" style={navButton(idx <= 0)}>‹</button>
        <span style={{ fontSize: 13, fontWeight: 600, minWidth: 48, textAlign: 'center' }}>{year}</span>
        <button
          onClick={() => setYear(years[idx + 1])}
          disabled={idx >= years.length - 1}
          aria-label="Next year"
          style={navButton(idx >= years.length - 1)}
        >›</button>
      </div>

      <div style={cardStyle}>
        {status === 'loading' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading...</div>}

        {status === 'error' && (
          <div style={{ fontSize: 12, color: 'var(--danger)' }}>
            {error} <button onClick={() => setRetry(k => k + 1)} style={{ ...retryButton, marginLeft: 8 }}>Retry</button>
          </div>
        )}

        {ready && data.projects.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>No invoices in {year}</div>
        )}

        {ready && data.projects.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <TurnoverHead label="Project" />
            <tbody>
              {data.projects.map(p => (
                <tr
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectProject(p.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProject(p.id); } }}
                  onMouseEnter={() => setHovered(p.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor: 'pointer', background: hovered === p.id ? 'var(--surface)' : 'transparent' }}
                >
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
        )}

        {ready && <TurnoverFooter lastSyncedAt={data.last_synced_at} />}
      </div>
    </div>
  );
}
