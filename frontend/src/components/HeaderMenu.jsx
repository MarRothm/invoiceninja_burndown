import React, { useState, useEffect, useRef } from 'react';
import ThemeSelector from './ThemeSelector.jsx';

const itemButton = (disabled) => ({
  width:        '100%',
  padding:      '8px 12px',
  background:   'var(--surface)',
  border:       '1px solid var(--border)',
  borderRadius: 4,
  color:        disabled ? 'var(--muted)' : 'var(--accent)',
  fontSize:     12,
  textAlign:    'left',
});

// ☰ menu in the header: Sync now, Show closed projects, Theme. Closes on outside click and Escape.
export default function HeaderMenu({ syncing, onSync, showClosed, onToggleClosed, themeKey, setThemeKey }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Menu"
        aria-expanded={open}
        style={{
          padding:      '4px 10px',
          background:   'var(--surface)',
          border:       '1px solid var(--border)',
          borderRadius: 4,
          color:        'var(--text)',
          fontSize:     18,
          lineHeight:   1,
        }}
      >☰</button>

      {open && (
        <div style={{
          position:      'absolute',
          right:         0,
          top:           'calc(100% + 6px)',
          zIndex:        10,
          minWidth:      220,
          padding:       12,
          background:    'var(--card)',
          border:        '1px solid var(--border)',
          borderRadius:  4,
          display:       'flex',
          flexDirection: 'column',
          gap:           10,
          boxShadow:     '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          <button
            onClick={() => { setOpen(false); onSync(); }}
            disabled={syncing}
            style={itemButton(syncing)}
          >
            {syncing ? '↻ Syncing…' : '↻ Sync now'}
          </button>

          {onToggleClosed && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={!!showClosed}
                onChange={e => onToggleClosed(e.target.checked)}
              />
              Show closed projects
            </label>
          )}

          <ThemeSelector themeKey={themeKey} setThemeKey={setThemeKey} />
        </div>
      )}
    </div>
  );
}
