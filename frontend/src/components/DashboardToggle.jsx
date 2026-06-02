import React from 'react';

export default function DashboardToggle({ mode, onToggle, aiAvailable }) {
  const isAI = mode === 'ai';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={() => aiAvailable && onToggle(isAI ? 'legacy' : 'ai')}
        disabled={!aiAvailable && !isAI}
        title={!aiAvailable ? 'Local AI unavailable' : isAI ? 'Switch to legacy dashboard' : 'Switch to AI dashboard'}
        style={{
          display:        'flex',
          alignItems:     'center',
          gap:            6,
          padding:        '5px 10px',
          background:     isAI ? 'var(--accent)' : 'var(--surface)',
          border:         `1px solid ${isAI ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius:   4,
          color:          isAI ? '#fff' : 'var(--text)',
          fontSize:       11,
          fontWeight:     600,
          cursor:         (aiAvailable || isAI) ? 'pointer' : 'not-allowed',
          opacity:        (!aiAvailable && !isAI) ? 0.5 : 1,
          transition:     'all 0.15s ease-in-out',
          letterSpacing:  '0.03em',
        }}
      >
        <span>{isAI ? '◈' : '◇'}</span>
        <span>{isAI ? 'AI Dashboard' : 'AI Dashboard'}</span>
      </button>
      {!aiAvailable && (
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>AI offline</span>
      )}
    </div>
  );
}
