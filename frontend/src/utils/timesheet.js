// Pure helpers for the monthly timesheet (formatting, export, month navigation)

const pad2 = (n) => String(n).padStart(2, '0');

/** Current month in the browser's local time zone, 'YYYY-MM'. */
export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

/** Move 'YYYY-MM' by delta months, e.g. shiftMonth('2026-01', -1) → '2025-12'. */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const idx = y * 12 + (m - 1) + delta;
  return `${Math.floor(idx / 12)}-${pad2((idx % 12) + 1)}`;
}

/** 'decimal' → '1.75', 'hhmm' → '1:45' */
export function formatHours(hours, format = 'decimal') {
  if (format === 'hhmm') {
    const minutes = Math.round(Number(hours) * 60);
    return `${Math.floor(minutes / 60)}:${pad2(minutes % 60)}`;
  }
  return Number(hours).toFixed(2);
}

/** Month as tab-separated lines (date, hours) — pastes into spreadsheets as two columns. */
export function toTSV(days, format) {
  return days.map(d => `${d.date}\t${formatHours(d.hours, format)}`).join('\n');
}

/** Month as CSV file content with UTF-8 BOM and header row. */
export function toCSV(days, format) {
  const rows = days.map(d => `${d.date},${formatHours(d.hours, format)}`);
  return '﻿' + ['date,hours', ...rows].join('\r\n') + '\r\n';
}

/** 'Website Relaunch', '2026-09' → 'timesheet_website-relaunch_2026-09.csv' */
export function fileName(projectName, month) {
  const slug = String(projectName ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';
  return `timesheet_${slug}_${month}.csv`;
}

/**
 * Copy text to the clipboard. Falls back to execCommand on non-secure (plain HTTP) origins,
 * where the async Clipboard API is unavailable. Returns true on success.
 */
export async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch { /* fall through to legacy copy */ }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
