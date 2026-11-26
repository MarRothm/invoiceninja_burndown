import React, { useContext } from 'react';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import StatusBadge from './StatusBadge.jsx';
import Badge from '../Badge.jsx';
import { formatMoney } from '../../utils/money.js';

export default function ProjectCardAI({ props: { projectId } }) {
  const { projects, thresholds } = useContext(AIDashboardContext);
  const project = projects.find(p => String(p.id) === String(projectId));

  if (!project) return null;
  if (project.billing_mode === 'lump_sum') return <LumpSumCard project={project} />;

  const { name, budgeted_hours, total_logged, progress } = project;
  const remaining = Math.max(0, budgeted_hours - total_logged);
  const { atRisk = 80, overBudget = 100 } = thresholds ?? {};
  const isOver = progress > overBudget;
  const color  = isOver ? '#da4830' : '#117cc1';
  const status = progress > overBudget ? 'over-budget' : progress >= atRisk ? 'at-risk' : 'on-budget';

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
          {project.status === 'closed' && <Badge>CLOSED</Badge>}
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

// Lump-sum project ("Pauschalabrechnung"): agreed lump sum and share earned (invoiced ÷ agreed) — no hours.
function LumpSumCard({ project: { name, status, lump_sum } }) {
  const { agreed, currency, invoiced, earned_pct } = lump_sum ?? {};
  const pct   = earned_pct ?? 0;
  const color = pct > 100 ? 'var(--accent2)' : 'var(--accent)';

  return (
    <div style={{
      background:   'var(--card)',
      border:       '1px solid var(--border)',
      borderRadius: 4,
      padding:      '14px 16px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{name}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {status === 'closed' && <Badge>CLOSED</Badge>}
          <Badge>LUMP SUM</Badge>
          {earned_pct != null && <span style={{ fontSize: 12, color, fontWeight: 700 }}>{earned_pct}%</span>}
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--border)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 2 }} />
      </div>
      <div style={{ display: 'flex', gap: 24, fontSize: 11, color: 'var(--muted)' }}>
        {agreed == null
          ? <span>Lump sum not set</span>
          : <span>Agreed: <strong style={{ color: 'var(--text)' }}>{formatMoney(agreed, currency)}</strong></span>}
        <span>Invoiced: <strong style={{ color }}>{formatMoney(invoiced, currency)}</strong></span>
      </div>
    </div>
  );
}
