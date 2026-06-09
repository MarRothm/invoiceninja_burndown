import React, { useContext } from 'react';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function ProjectCardAI({ props: { projectId } }) {
  const { projects } = useContext(AIDashboardContext);
  const project = projects.find(p => String(p.id) === String(projectId));

  if (!project) return null;

  const { name, budgeted_hours, total_logged, progress } = project;
  const remaining = Math.max(0, budgeted_hours - total_logged);
  const isOver    = progress > 100;
  const color     = isOver ? '#da4830' : '#117cc1';
  const status    = progress > 100 ? 'over-budget' : progress >= 80 ? 'at-risk' : 'on-budget';

  return (
    <div style={{
      background:   'var(--card, #fff)',
      border:       `1px solid var(--border, #ddd)`,
      borderRadius: 4,
      padding:      '14px 16px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text, #333)' }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge props={{ status }} />
          <span style={{ fontSize: 12, color, fontWeight: 700 }}>{progress}%</span>
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--border, #ddd)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 11, color: 'var(--muted, #777)' }}>
        <span>Budget: <strong style={{ color: 'var(--text, #333)' }}>{budgeted_hours}h</strong></span>
        <span>Logged: <strong style={{ color }}>{total_logged}h</strong></span>
        <span>Remaining: <strong style={{ color: 'var(--text, #333)' }}>{remaining}h</strong></span>
      </div>
    </div>
  );
}
