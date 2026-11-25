import React from 'react';
import { formatMoney } from '../utils/money.js';

const badgeStyle = {
  fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
  padding: '2px 5px', borderRadius: 3,
  background: 'var(--border)', color: 'var(--muted)',
};

export default function ProjectCard({ project, selected, onClick, onOpenTimesheet }) {
  const { name, progress, total_logged, budgeted_hours, deadline, actual_end_date, status, lump_sum } = project;
  const isLumpSum = project.billing_mode === 'lump_sum';
  // Lump-sum projects: the bar and percentage show the lump sum earned, not hours
  const pct      = isLumpSum ? (lump_sum?.earned_pct ?? 0) : progress;
  const isClosed = status === 'closed';
  const isOver   = pct > 100;
  const color    = isClosed ? 'var(--muted)' : isOver ? 'var(--accent2)' : 'var(--accent)';
  const endDate  = actual_end_date || deadline;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); }
      }}
      style={{
        display:       'block',
        width:         '100%',
        textAlign:     'left',
        background:    selected ? 'var(--card)' : 'transparent',
        border:        `1px solid ${selected ? color : 'var(--border)'}`,
        borderRadius:  4,
        padding:       '12px 14px',
        transition:    'border-color 0.15s ease-in-out, background 0.15s ease-in-out',
        cursor:        'pointer',
        opacity:       isClosed ? 0.7 : 1,
      }}
    >
      {/* Name + Status-Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{name}</span>
        {isLumpSum && <span style={badgeStyle}>LUMP SUM</span>}
        {isClosed && <span style={badgeStyle}>CLOSED</span>}
        {onOpenTimesheet && !isLumpSum && (
          <button
            onClick={e => { e.stopPropagation(); onOpenTimesheet(); }}
            title="Timesheet"
            aria-label={`Open timesheet for ${name}`}
            style={{
              background: 'none', border: 'none', padding: '0 2px',
              color: 'var(--muted)', fontSize: 13, lineHeight: 1, cursor: 'pointer',
            }}
          >▦</button>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(pct, 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
        {isLumpSum && lump_sum?.agreed == null && <span>Lump sum not set</span>}
        {isLumpSum && lump_sum?.agreed != null && (<>
          <span style={{ color }}>{pct}%</span>
          <span>{formatMoney(lump_sum.agreed, lump_sum.currency)}</span>
        </>)}
        {!isLumpSum && (<>
          <span style={{ color }}>{progress}%</span>
          <span>{total_logged}h / {budgeted_hours}h</span>
        </>)}
        {endDate && <span>{new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
      </div>
    </div>
  );
}
