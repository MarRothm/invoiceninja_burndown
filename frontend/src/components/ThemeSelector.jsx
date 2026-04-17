import React from 'react';
import { themes } from '../themes.js';

export default function ThemeSelector({ themeKey, setThemeKey }) {
  return (
    <div style={{ paddingTop: 16, borderTop: '1px solid var(--border)' }}>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6, letterSpacing: '0.08em' }}>
        THEME
      </div>
      <select
        value={themeKey}
        onChange={e => setThemeKey(e.target.value)}
        style={{
          width: '100%',
          padding: '6px 8px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--text)',
          fontSize: 12,
          cursor: 'pointer',
          outline: 'none',
          fontFamily: 'inherit',
        }}
      >
        {Object.entries(themes).map(([key, theme]) => (
          <option key={key} value={key}>{theme.name}</option>
        ))}
      </select>
    </div>
  );
}
