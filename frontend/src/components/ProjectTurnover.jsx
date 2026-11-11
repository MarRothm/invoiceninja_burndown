import React, { useState, useEffect } from 'react';
import { fetchProjectTurnover } from '../hooks/api.js';
import { formatEUR } from '../utils/timesheet.js';

export const cardStyle = {
  background:   'var(--card)',
  border:       '1px solid var(--border)',
  borderRadius: 4,
  padding:      '20px 20px 14px',
};

export const retryButton = {
  padding:      '6px 12px',
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: 4,
  color:        'var(--accent)',
  fontSize:     12,
  cursor:       'pointer',
};

const cell = { padding: '6px 0 6px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' };

/** Header row: first column label + Invoiced / Paid / Open */
export function TurnoverHead({ label }) {
  const head = { ...cell, fontSize: 11, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' };
  return (
    <thead>
      <tr>
        <th style={{ ...head, textAlign: 'left', paddingLeft: 0 }}>{label}</th>
        <th style={head}>Invoiced</th>
        <th style={head}>Paid</th>
        <th style={head}>Open</th>
      </tr>
    </thead>
  );
}

/** Invoiced / paid / open cells; open > 0 highlighted, 0 muted */
export function AmountCells({ row, bold = false }) {
  const weight = bold ? 700 : 400;
  return (
    <>
      <td style={{ ...cell, fontWeight: weight }}>{formatEUR(row.invoiced)}</td>
      <td style={{ ...cell, fontWeight: weight }}>{formatEUR(row.paid)}</td>
      <td style={{ ...cell, fontWeight: weight, color: row.open > 0 ? 'var(--accent2)' : 'var(--muted)' }}>
        {formatEUR(row.open)}
      </td>
    </>
  );
}

export const totalRowStyle = { borderTop: '1px solid var(--border)' };

/** "Gross amounts incl. VAT · Last synced: …" */
export function TurnoverFooter({ lastSyncedAt }) {
  return (
    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12 }}>
      Gross amounts incl. VAT · Last synced: {lastSyncedAt
        ? new Date(lastSyncedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'never'}
    </div>
  );
}

export default function ProjectTurnover({ projectId, reloadKey }) {
  const [data,   setData]   = useState(null);
  const [status, setStatus] = useState('loading');
  const [error,  setError]  = useState(null);
  const [retry,  setRetry]  = useState(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fetchProjectTurnover(projectId)
      .then(d  => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(e => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [projectId, reloadKey, retry]);

  return (
    <div style={{ ...cardStyle, marginTop: 24 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>TURNOVER</div>

      {status === 'loading' && <div style={{ fontSize: 13, color: 'var(--muted)' }}>Loading...</div>}

      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>
          {error} <button onClick={() => setRetry(k => k + 1)} style={{ ...retryButton, marginLeft: 8 }}>Retry</button>
        </div>
      )}

      {status === 'ready' && data.years.length === 0 && (
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>No invoices yet</div>
      )}

      {status === 'ready' && data.years.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <TurnoverHead label="Year" />
          <tbody>
            {data.years.map(y => (
              <tr key={y.year}>
                <td style={{ padding: '6px 0', fontWeight: 600 }}>{y.year}</td>
                <AmountCells row={y} />
              </tr>
            ))}
            <tr style={totalRowStyle}>
              <td style={{ padding: '6px 0', fontWeight: 700 }}>Total</td>
              <AmountCells row={data.total} bold />
            </tr>
          </tbody>
        </table>
      )}

      {status === 'ready' && <TurnoverFooter lastSyncedAt={data.last_synced_at} />}
    </div>
  );
}
