import React, { useState, useEffect, useCallback } from 'react';
import ThemeSelector from './components/ThemeSelector.jsx';
import AIDashboard from './components/ai/AIDashboard.jsx';
import TimesheetModal from './components/TimesheetModal.jsx';
import TurnoverOverview from './components/TurnoverOverview.jsx';
import { triggerSync, fetchAIStatus } from './hooks/api.js';
import { useTheme } from './hooks/useTheme.js';

export default function App() {
  const { themeKey, setThemeKey, theme } = useTheme();

  const [syncing,      setSyncing]      = useState(false);
  const [error,        setError]        = useState(null);
  // 'checking' until the first status response — the dashboard must not judge availability before
  const [aiStatus,     setAIStatus]     = useState({ ollama: 'checking', cached: false });
  const [aiReloadKey,  setAiReloadKey]  = useState(0);
  const [timesheetProject, setTimesheetProject] = useState(null);
  const [timesheetMonth,   setTimesheetMonth]   = useState(null);
  const closeTimesheet = useCallback(() => { setTimesheetProject(null); setTimesheetMonth(null); }, []);
  // AI TimesheetSummary block: open the full timesheet on the block's month
  const openTimesheetFromAI = useCallback((p, m) => { setTimesheetMonth(m); setTimesheetProject(p); }, []);
  const [view,         setView]         = useState('dashboard');
  const [turnoverKey,  setTurnoverKey]  = useState(0);

  // The classic dashboard is gone — drop its stored preference (feature 009)
  useEffect(() => { localStorage.removeItem('burndown_dashboard_mode'); }, []);

  // Poll AI status on mount and every 15 s (to detect Ollama coming online)
  useEffect(() => {
    const check = () => fetchAIStatus().then(setAIStatus).catch(() => {});
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  // Overview row click: back to the AI Dashboard (the only dashboard)
  const openProjectFromTurnover = () => setView('dashboard');

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      setAiReloadKey(k => k + 1);
      setTurnoverKey(k => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── Sidebar ── */}
      <aside className="sidebar" style={{
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
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>
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
            borderRadius: 4,
            color: syncing ? 'var(--muted)' : 'var(--accent)',
            fontSize: 12,
            marginBottom: 8,
            transition: 'opacity 0.15s ease-in-out',
          }}
        >
          {syncing ? '↻ Syncing...' : '↻ Sync now'}
        </button>

        {/* Turnover overview */}
        <button
          onClick={() => setView(v => (v === 'turnover' ? 'dashboard' : 'turnover'))}
          aria-pressed={view === 'turnover'}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--surface)',
            border: `1px solid ${view === 'turnover' ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 4,
            color: 'var(--accent)',
            fontSize: 12,
            marginBottom: 8,
            transition: 'opacity 0.15s ease-in-out',
          }}
        >
          € Turnover
        </button>

        <div style={{ flex: 1 }} />
        <ThemeSelector themeKey={themeKey} setThemeKey={setThemeKey} />
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>

        {/* Sync error — visible in every view */}
        {error && (
          <div style={{ background: 'rgba(218,72,48,0.08)', border: '1px solid var(--danger)', borderRadius: 4, padding: '12px 16px', fontSize: 12, color: 'var(--danger)', marginBottom: 20 }}>
            {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', float: 'right' }}>✕</button>
          </div>
        )}

        {view === 'turnover' ? (
          <TurnoverOverview reloadKey={turnoverKey} onSelectProject={openProjectFromTurnover} />
        ) : (
          <AIDashboard
            key={aiReloadKey}
            theme={theme}
            ollamaStatus={aiStatus.ollama}
            cached={aiStatus.cached}
            model={aiStatus.model}
            onOpenTimesheet={openTimesheetFromAI}
          />
        )}
      </main>

      {timesheetProject && (
        <TimesheetModal project={timesheetProject} onClose={closeTimesheet} initialMonth={timesheetMonth ?? undefined} />
      )}
    </div>
  );
}
