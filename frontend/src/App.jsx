import React, { useState, useEffect, useCallback } from 'react';
import ProjectCard from './components/ProjectCard.jsx';
import BurndownChart from './components/BurndownChart.jsx';
import { fetchProjects, fetchBurndown, triggerSync } from './hooks/api.js';

const Stat = ({ label, value, color }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: color ?? 'var(--text)', fontFamily: "'Fraunces', serif", lineHeight: 1 }}>
      {value}
    </div>
    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{label}</div>
  </div>
);

export default function App() {
  const [projects,   setProjects]   = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [burndown,   setBurndown]   = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [chartLoad,  setChartLoad]  = useState(false);
  const [syncing,    setSyncing]    = useState(false);
  const [error,      setError]      = useState(null);

  const loadProjects = useCallback(async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
      if (!selected && data.length) setSelected(data[0]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (!selected) return;
    setChartLoad(true);
    setBurndown(null);
    fetchBurndown(selected.id)
      .then(setBurndown)
      .catch(e => setError(e.message))
      .finally(() => setChartLoad(false));
  }, [selected?.id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      await loadProjects();
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 260,
        flexShrink: 0,
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        gap: 8,
        overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
            Burndown
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>via InvoiceNinja</div>
        </div>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: syncing ? 'var(--muted)' : 'var(--accent)',
            fontSize: 12,
            marginBottom: 8,
            transition: 'opacity 0.15s',
          }}
        >
          {syncing ? '↻ Syncing...' : '↻ Sync jetzt'}
        </button>

        {/* Project list */}
        {loading && <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', marginTop: 24 }}>Lade...</div>}
        {projects.map(p => (
          <ProjectCard
            key={p.id}
            project={p}
            selected={selected?.id === p.id}
            onClick={() => setSelected(p)}
          />
        ))}
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>

        {error && (
          <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--danger)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--danger)', marginBottom: 20 }}>
            {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', float: 'right' }}>✕</button>
          </div>
        )}

        {!selected && !loading && (
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 60, textAlign: 'center' }}>
            Kein Projekt ausgewählt.
          </div>
        )}

        {selected && (
          <>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>PROJEKT</div>
              <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>
                {selected.name}
              </h1>
              {selected.deadline && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  Deadline: {new Date(selected.deadline).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
            </div>

            {/* Stats */}
            {burndown && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 1,
                background: 'var(--border)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                overflow: 'hidden',
                marginBottom: 28,
              }}>
                {[
                  { label: 'Budget', value: `${burndown.project.budgeted_hours}h` },
                  { label: 'Gebucht', value: `${burndown.stats.total_logged}h`, color: 'var(--accent)' },
                  { label: 'Verbleibend', value: `${burndown.stats.remaining}h`,
                    color: burndown.stats.remaining === 0 ? 'var(--accent2)' : 'var(--text)' },
                  { label: 'Fortschritt', value: `${burndown.stats.progress}%`,
                    color: burndown.stats.progress > 100 ? 'var(--accent2)' : 'var(--accent3)' },
                ].map(s => (
                  <div key={s.label} style={{ background: 'var(--card)', padding: '18px 0' }}>
                    <Stat {...s} />
                  </div>
                ))}
              </div>
            )}

            {/* Chart */}
            <div style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 10,
              padding: '24px 20px 16px',
            }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>BURNDOWN CHART</div>
              {chartLoad && (
                <div style={{ height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  Berechne...
                </div>
              )}
              {burndown && !chartLoad && (
                <BurndownChart data={burndown.burndown} budgetedHours={burndown.project.budgeted_hours} />
              )}
            </div>

            {/* Legend note */}
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, display: 'flex', gap: 24 }}>
              <span><span style={{ color: 'var(--accent3)' }}>──</span> Ideal-Linie</span>
              <span><span style={{ color: 'var(--accent)' }}>──</span> Actual (kumuliert)</span>
              <span><span style={{ color: 'rgba(163,230,53,0.5)' }}>▮</span> Gebucht pro Tag</span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
