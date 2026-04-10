import React from 'react';
import { themes } from '../themes.js';

export default function ThemeSelector({ themeKey, setThemeKey }) {
  return (
    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 8, letterSpacing: '0.08em' }}>
        THEME
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {Object.entries(themes).map(([key, theme]) => {
          const active = key === themeKey;
          return (
            <button
              key={key}
              title={theme.name}
              onClick={() => setThemeKey(key)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 5,
                padding: '6px 4px',
                background: 'transparent',
                border: `1px solid ${active ? theme.vars['--accent'] : 'var(--border)'}`,
                borderRadius: 6,
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Color swatch */}
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: theme.vars['--accent'],
                boxShadow: active ? `0 0 0 2px ${theme.vars['--accent']}40` : 'none',
                transition: 'box-shadow 0.15s',
              }} />
              <span style={{
                fontSize: 9,
                color: active ? 'var(--text)' : 'var(--muted)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}>
                {theme.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
