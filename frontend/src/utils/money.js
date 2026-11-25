import { formatEUR } from './timesheet.js';

const FRACTION = { minimumFractionDigits: 2, maximumFractionDigits: 2 };

/**
 * Amount in a project currency (lump-sum projects).
 * EUR → '10,000.00 €' (same as formatEUR); CHF → 'CHF 10,000.00'; unknown code → '10,000.00 XYZ'; null → '—'.
 */
export function formatMoney(amount, currency = 'EUR') {
  if (amount === null || amount === undefined) return '—';
  if (currency === 'EUR') return formatEUR(amount);
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, ...FRACTION }).format(amount);
  } catch {
    return `${Number(amount).toLocaleString('en-GB', FRACTION)} ${currency}`;
  }
}
