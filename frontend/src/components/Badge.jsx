import React from 'react';

// Small uppercase label (LUMP SUM, CLOSED) — design tokens only.
export default function Badge({ children }) {
  return (
    <span style={{
      fontSize:      10,
      fontWeight:    600,
      letterSpacing: '0.05em',
      padding:       '2px 8px',
      borderRadius:  3,
      background:    'var(--border)',
      color:         'var(--muted)',
      whiteSpace:    'nowrap',
    }}>{children}</span>
  );
}
