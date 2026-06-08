import React from 'react';

const CONFIG = {
  'on-budget':  { label: 'On Budget',   bg: 'rgba(54,193,87,0.12)',  color: '#36c157', border: '#36c157' },
  'at-risk':    { label: 'At Risk',      bg: 'rgba(226,115,41,0.12)', color: '#e27329', border: '#e27329' },
  'over-budget':{ label: 'Over Budget',  bg: 'rgba(218,72,48,0.12)',  color: '#da4830', border: '#da4830' },
};

export default function StatusBadge({ props: { status } }) {
  const cfg = CONFIG[status] ?? CONFIG['on-budget'];
  return (
    <span style={{
      display:      'inline-block',
      padding:      '2px 8px',
      borderRadius: 3,
      fontSize:     10,
      fontWeight:   600,
      letterSpacing:'0.05em',
      textTransform:'uppercase',
      background:   cfg.bg,
      color:        cfg.color,
      border:       `1px solid ${cfg.border}`,
    }}>
      {cfg.label}
    </span>
  );
}
