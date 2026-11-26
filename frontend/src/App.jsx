import React, { useState, useEffect, useCallback } from 'react';
import HeaderMenu from './components/HeaderMenu.jsx';
import AIDashboard from './components/ai/AIDashboard.jsx';
import TimesheetModal from './components/TimesheetModal.jsx';
import { triggerSync, fetchAIStatus } from './hooks/api.js';
import { useTheme } from './hooks/useTheme.js';

const SHOW_CLOSED_KEY = 'burndown_show_closed';

export default function App() {
  const { themeKey, setThemeKey, theme } = useTheme();

  const [syncing,      setSyncing]      = useState(false);
  const [error,        setError]        = useState(null);
  // 'checking' until the first status response — the dashboard must not judge availability before
  const [aiStatus,     setAIStatus]     = useState({ ollama: 'checking', cached: false });
  const [aiReloadKey,  setAiReloadKey]  = useState(0);
  const [showClosed,   setShowClosed]   = useState(() => localStorage.getItem(SHOW_CLOSED_KEY) === '1');
  const [timesheetProject, setTimesheetProject] = useState(null);
  const [timesheetMonth,   setTimesheetMonth]   = useState(null);
  const closeTimesheet = useCallback(() => { setTimesheetProject(null); setTimesheetMonth(null); }, []);
  // AI TimesheetSummary block: open the full timesheet on the block's month
  const openTimesheetFromAI = useCallback((p, m) => { setTimesheetMonth(m); setTimesheetProject(p); }, []);

  // The classic dashboard is gone — drop its stored preference (feature 009)
  useEffect(() => { localStorage.removeItem('burndown_dashboard_mode'); }, []);

  // Poll AI status on mount and every 15 s (to detect Ollama coming online)
  useEffect(() => {
    const check = () => fetchAIStatus().then(setAIStatus).catch(() => {});
    check();
    const id = setInterval(check, 15_000);
    return () => clearInterval(id);
  }, []);

  const toggleClosed = (on) => {
    setShowClosed(on);
    localStorage.setItem(SHOW_CLOSED_KEY, on ? '1' : '0');
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      setAiReloadKey(k => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <header className="app-header" style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 36px',
        borderBottom:   '1px solid var(--border)',
        position:       'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>Burndown</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>via InvoiceNinja</span>
        </div>
        <HeaderMenu
          syncing={syncing}
          onSync={handleSync}
          showClosed={showClosed}
          onToggleClosed={toggleClosed}
          themeKey={themeKey}
          setThemeKey={setThemeKey}
        />
      </header>

      {/* ── Main ── */}
      <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto' }}>

        {/* Sync error — shown above the dashboard */}
        {error && (
          <div style={{ background: 'rgba(218,72,48,0.08)', border: '1px solid var(--danger)', borderRadius: 4, padding: '12px 16px', fontSize: 12, color: 'var(--danger)', marginBottom: 20 }}>
            {error} <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'var(--danger)', float: 'right' }}>✕</button>
          </div>
        )}

        <AIDashboard
          key={aiReloadKey}
          theme={theme}
          ollamaStatus={aiStatus.ollama}
          cached={aiStatus.cached}
          model={aiStatus.model}
          showClosed={showClosed}
          onOpenTimesheet={openTimesheetFromAI}
        />
      </main>

      {timesheetProject && (
        <TimesheetModal project={timesheetProject} onClose={closeTimesheet} initialMonth={timesheetMonth ?? undefined} />
      )}
    </div>
  );
}
