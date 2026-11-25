import React, { useState, useEffect, useContext } from 'react';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import { fetchTimesheet } from '../../hooks/api.js';
import { currentMonth, formatHours, formatEUR, formatRate } from '../../utils/timesheet.js';

// The month is resolved at render time when omitted, so a cached layout never goes stale.
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// AI block: month total of booked hours with hour rate and EUR for one project.
// Click / Enter opens the full existing timesheet (copy + CSV) for that month.
export default function TimesheetSummaryAI({ props: { projectId, month } }) {
  const m = MONTH_RE.test(month ?? '') ? month : currentMonth();
  const { projects, onOpenTimesheet } = useContext(AIDashboardContext);
  const project = projects.find(p => String(p.id) === String(projectId));
  // Lump-sum projects are not billed by time — no timesheet block (whatever the model emitted)
  const isLumpSum = project?.billing_mode === 'lump_sum';

  const [data,   setData]   = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    if (isLumpSum) return;
    let cancelled = false;
    setStatus('loading');
    fetchTimesheet(projectId, m)
      .then(d  => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [projectId, m, isLumpSum]);

  if (isLumpSum) return null;

  const open = () => {
    const target = project ?? data?.project;
    if (target && onOpenTimesheet) onOpenTimesheet(target, m);
  };
  const ready = status === 'ready';

  return (
    <div
      role={ready ? 'button' : undefined}
      tabIndex={ready ? 0 : undefined}
      title={ready ? 'Open full timesheet' : undefined}
      onClick={ready ? open : undefined}
      onKeyDown={ready ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } } : undefined}
      style={{
        background:   'var(--card)',
        border:       '1px solid var(--border)',
        borderRadius: 4,
        padding:      '10px 16px',
        marginBottom: 16,
        cursor:       ready ? 'pointer' : 'default',
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>TIMESHEET {m}</div>

      {status === 'loading' && <div style={{ fontSize: 12, color: 'var(--muted)' }}>Loading timesheet…</div>}

      {status === 'error' && (
        <div style={{ fontSize: 12, color: 'var(--danger)' }}>
          {project ? 'Timesheet could not be loaded.' : 'Project not found'}
        </div>
      )}

      {ready && (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap', fontSize: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>
            {formatHours(data.total)} h
          </span>
          <span style={{ color: 'var(--muted)' }}>
            {data.rate === null ? 'No hour rate set' : formatRate(data.rate)}
          </span>
          <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatEUR(data.amount)}</span>
        </div>
      )}
    </div>
  );
}
