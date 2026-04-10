export const themes = {
  invoiceninja: {
    name: 'InvoiceNinja dark',
    vars: {
      '--bg':        '#1b1e2e',
      '--surface':   '#22263b',
      '--card':      '#272b42',
      '--border':    '#323760',
      '--text':      '#e2e8f0',
      '--muted':     '#8892b0',
      '--accent':    '#6366f1',
      '--accent2':   '#f59e0b',
      '--accent3':   '#22d3ee',
      '--danger':    '#f87171',
      '--dot-color': 'rgba(99,102,241,0.07)',
    },
    barFill:   'rgba(99,102,241,0.15)',
    barStroke: 'rgba(99,102,241,0.35)',
  },

  dark: {
    name: 'Venom Green',
    vars: {
      '--bg':        '#0d0f0e',
      '--surface':   '#141716',
      '--card':      '#191c1a',
      '--border':    '#232825',
      '--text':      '#e8ede9',
      '--muted':     '#5c6660',
      '--accent':    '#a3e635',
      '--accent2':   '#fb923c',
      '--accent3':   '#38bdf8',
      '--danger':    '#f87171',
      '--dot-color': 'rgba(163,230,53,0.06)',
    },
    barFill:   'rgba(163,230,53,0.18)',
    barStroke: 'rgba(163,230,53,0.35)',
  },

  light: {
    name: 'InvoiceNinja light',
    vars: {
      '--bg':        '#f1f5f9',
      '--surface':   '#ffffff',
      '--card':      '#f8fafc',
      '--border':    '#e2e8f0',
      '--text':      '#0f172a',
      '--muted':     '#64748b',
      '--accent':    '#4f46e5',
      '--accent2':   '#ea580c',
      '--accent3':   '#0284c7',
      '--danger':    '#dc2626',
      '--dot-color': 'rgba(79,70,229,0.05)',
    },
    barFill:   'rgba(79,70,229,0.12)',
    barStroke: 'rgba(79,70,229,0.30)',
  },
};

export const defaultTheme = 'invoiceninja';
