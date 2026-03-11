import React from 'react';

export default function ProjectCard({ project, selected, onClick }) {
  const { name, progress, total_logged, budgeted_hours, deadline, actual_end_date, status } = project;
  const isClosed = status === 'closed';
  const isOver   = progress > 100;
  const color    = isClosed ? 'var(--muted)' : isOver ? 'var(--accent2)' : 'var(--accent)';
  const endDate  = actual_end_date || deadline;

  return (
    <button
      onClick={onClick}
      style={{
        display:       'block',
        width:         '100%',
        textAlign:     'left',
        background:    selected ? 'var(--card)' : 'transparent',
        border:        `1px solid ${selected ? color : 'var(--border)'}`,
        borderRadius:  8,
        padding:       '14px 16px',
        transition:    'border-color 0.15s, background 0.15s',
        cursor:        'pointer',
        opacity:       isClosed ? 0.7 : 1,
      }}
    >
      {/* Name + Status-Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', flex: 1 }}>{name}</span>
        {isClosed && (
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: '0.05em',
            padding: '2px 6px', borderRadius: 4,
            background: 'var(--border)', color: 'var(--muted)',
          }}>CLOSED</span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(progress, 100)}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)' }}>
        <span style={{ color }}>{progress}%</span>
        <span>{total_logged}h / {budgeted_hours}h</span>
        {endDate && <span>{new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
      </div>
    </button>
  );
}
