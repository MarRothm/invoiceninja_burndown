// Lump-sum projects ("Pauschalabrechnung"): derived from the synced InvoiceNinja project JSON.
// Pure helpers — no DB access.

const LUMP_SUM_TAG = 'pauschalabrechnung';

const round2 = (n) => Math.round(n * 100) / 100;

/** True if the InvoiceNinja tags array ({ id, name, color }[]) contains the lump-sum tag. */
export function isLumpSum(tags) {
  return Array.isArray(tags)
    && tags.some(t => String(t?.name ?? '').trim().toLowerCase() === LUMP_SUM_TAG);
}

/**
 * Agreed lump sum from custom field 3. Accepts German and English separators
 * ("10.000,00", "10,000.00", "10'000", "10000"). Returns a number > 0, or null.
 * A single separator followed by exactly 3 digits is a thousands separator ("1.500" → 1500).
 */
export function parseAmount(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).replace(/[^0-9.,-]/g, '');
  if (!s || s.includes('-')) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let normalized;

  if (lastDot !== -1 && lastComma !== -1) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thousands = dec === '.' ? ',' : '.';
    normalized = s.split(thousands).join('').replace(dec, '.');
  } else if (lastDot !== -1 || lastComma !== -1) {
    const sep = lastDot !== -1 ? '.' : ',';
    const parts = s.split(sep);
    const isThousands = parts.length > 2 || parts[1].length === 3;
    normalized = isThousands ? parts.join('') : parts.join('.');
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Project currency from custom field 4; EUR when empty. */
export function parseCurrency(raw) {
  const c = String(raw ?? '').trim().toUpperCase();
  return c || 'EUR';
}

/**
 * Billing mode and lump-sum figures for one project.
 * `invoiced` is the summed amount of counted invoices (all years), as NUMERIC string or number.
 */
export function lumpSumOf({ tags, cv3, cv4, invoiced }) {
  if (!isLumpSum(tags)) return { billing_mode: 'hourly', lump_sum: null };

  const agreed = parseAmount(cv3);
  const inv    = round2(parseFloat(invoiced) || 0);
  return {
    billing_mode: 'lump_sum',
    lump_sum: {
      agreed,
      currency:   parseCurrency(cv4),
      invoiced:   inv,
      earned_pct: agreed === null ? null : Math.round((inv / agreed) * 100),
    },
  };
}
