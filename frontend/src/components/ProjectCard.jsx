import React from 'react';

export default function ProjectCard({ project, selected, onClick }) {
  const { name, progress, total_logged, budgeted_hours, remaining, deadline } = project;
  const isOver = progress > 100;
  const color  = isOver ? 'var(--accent2)' : 'var(--accent)';

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
      }}
    >
      {/* Name */}
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>
        {name}
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
        {deadline && <span>{new Date(deadline).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}</span>}
      </div>
    </button>
  );
}
