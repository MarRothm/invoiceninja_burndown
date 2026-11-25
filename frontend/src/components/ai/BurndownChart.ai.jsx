import React, { useState, useEffect, useContext } from 'react';
import BurndownChart from '../BurndownChart.jsx';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import { fetchBurndown } from '../../hooks/api.js';
import ProjectTurnoverAI from './ProjectTurnover.ai.jsx';

export default function BurndownChartAI({ props: { projectId } }) {
  const { theme, projects } = useContext(AIDashboardContext);
  // Lump-sum projects have no hour burndown — show their turnover instead (whatever the model emitted)
  const isLumpSum = projects.find(p => String(p.id) === String(projectId))?.billing_mode === 'lump_sum';
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLumpSum) return;
    let cancelled = false;
    fetchBurndown(projectId)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId, isLumpSum]);

  if (isLumpSum) return <ProjectTurnoverAI props={{ projectId }} />;

  if (loading) {
    return (
      <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted, #777)', fontSize: 12 }}>
        Loading chart…
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ background: 'var(--card, #fff)', border: '1px solid var(--border, #ddd)', borderRadius: 4, padding: '16px 12px', marginBottom: 16 }}>
      <BurndownChart data={data.burndown} barFill={theme.barFill} barStroke={theme.barStroke} />
    </div>
  );
}
