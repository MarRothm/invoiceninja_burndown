export const themes = {
  invoiceninja: {
    name: 'InvoiceNinja dark',
    vars: {
      '--bg':          '#1a1d23',
      '--surface':     '#242930',
      '--card':        '#2f2e2e',
      '--border':      '#363d47',
      '--text':        '#e2e8f0',
      '--muted':       '#8892b0',
      '--accent':      '#117cc1',
      '--accent2':     '#e27329',
      '--accent3':     '#36c157',
      '--danger':      '#da4830',
      '--dot-color':   'rgba(17,124,193,0.07)',
      '--font-family': "'Inter', sans-serif",
    },
    barFill:   'rgba(17,124,193,0.15)',
    barStroke: 'rgba(17,124,193,0.40)',
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
      '--bg':          '#f8f8f8',
      '--surface':     '#ffffff',
      '--card':        '#ffffff',
      '--border':      '#dddddd',
      '--text':        '#333333',
      '--muted':       '#777777',
      '--accent':      '#117cc1',
      '--accent2':     '#e27329',
      '--accent3':     '#36c157',
      '--danger':      '#da4830',
      '--dot-color':   'rgba(17,124,193,0.04)',
      '--font-family': "'Inter', sans-serif",
    },
    barFill:   'rgba(17,124,193,0.12)',
    barStroke: 'rgba(17,124,193,0.35)',
  },
};

export const defaultTheme = 'invoiceninja';
