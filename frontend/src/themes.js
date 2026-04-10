export const themes = {
  invoiceninja: {
    name: 'InvoiceNinja dark',
    vars: {
      '--bg':          '#1b1e2e',
      '--surface':     '#22263b',
      '--card':        '#272b42',
      '--border':      '#323760',
      '--text':        '#e2e8f0',
      '--muted':       '#8892b0',
      '--accent':      '#6366f1',
      '--accent2':     '#f59e0b',
      '--accent3':     '#22d3ee',
      '--danger':      '#f87171',
      '--dot-color':   'rgba(99,102,241,0.07)',
      '--font-family': "'DM Mono', monospace",
    },
    barFill:   'rgba(99,102,241,0.15)',
    barStroke: 'rgba(99,102,241,0.35)',
  },

  dark: {
    name: 'Venom Green',
    vars: {
      '--bg':          '#0d0f0e',
      '--surface':     '#141716',
      '--card':        '#191c1a',
      '--border':      '#232825',
      '--text':        '#e8ede9',
      '--muted':       '#5c6660',
      '--accent':      '#a3e635',
      '--accent2':     '#fb923c',
      '--accent3':     '#38bdf8',
      '--danger':      '#f87171',
      '--dot-color':   'rgba(163,230,53,0.06)',
      '--font-family': "'DM Mono', monospace",
    },
    barFill:   'rgba(163,230,53,0.18)',
    barStroke: 'rgba(163,230,53,0.35)',
  },

  light: {
    name: 'InvoiceNinja light',
    vars: {
      '--bg':          '#f4f6f8',
      '--surface':     '#ffffff',
      '--card':        '#ffffff',
      '--border':      '#e2e8f0',
      '--text':        '#1e293b',
      '--muted':       '#64748b',
      '--accent':      '#3b82f6',
      '--accent2':     '#f97316',
      '--accent3':     '#22c55e',
      '--danger':      '#ef4444',
      '--dot-color':   'rgba(59,130,246,0.04)',
      '--font-family': "'Nunito', sans-serif",
    },
    barFill:   'rgba(59,130,246,0.12)',
    barStroke: 'rgba(59,130,246,0.32)',
  },
};

export const defaultTheme = 'invoiceninja';
