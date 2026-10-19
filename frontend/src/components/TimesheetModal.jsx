import React, { useState, useEffect, useRef } from 'react';
import { fetchTimesheet } from '../hooks/api.js';
import {
  currentMonth, shiftMonth, formatHours, toTSV, toCSV, fileName, copyText,
} from '../utils/timesheet.js';

const FORMAT_KEY = 'burndown_timesheet_format';
const COPY_FAILED = 'Copy not available — use Download CSV';

const shortDate = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

const actionButton = (disabled) => ({
  padding:    '8px 12px',
  background: 'var(--surface)',
  border:     '1px solid var(--border)',
  borderRadius: 4,
  color:      disabled ? 'var(--muted)' : 'var(--accent)',
  fontSize:   12,
  cursor:     disabled ? 'not-allowed' : 'pointer',
  transition: 'opacity 0.15s ease-in-out',
});

const navButton = (disabled) => ({
  padding:    '2px 8px',
  background: 'transparent',
  border:     '1px solid var(--border)',
  borderRadius: 4,
  color:      disabled ? 'var(--muted)' : 'var(--text)',
  fontSize:   13,
  cursor:     disabled ? 'not-allowed' : 'pointer',
  opacity:    disabled ? 0.5 : 1,
});

function FormatToggle({ format, onChange }) {
  const segment = (value, label) => {
    const active = format === value;
    return (
      <button
        onClick={() => onChange(value)}
        aria-pressed={active}
        style={{
          padding:    '3px 8px',
          background: active ? 'var(--accent)' : 'var(--surface)',
          border:     'none',
          color:      active ? '#fff' : 'var(--text)',
          fontSize:   11,
          fontWeight: 600,
          cursor:     'pointer',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        {label}
      </button>
    );
  };
  return (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
      {segment('decimal', '1.75')}
      {segment('hhmm', '1:45')}
    </div>
  );
}

export default function TimesheetModal({ project, onClose }) {
  const [month,     setMonth]     = useState(currentMonth);
  const [format,    setFormat]    = useState(() => localStorage.getItem(FORMAT_KEY) ?? 'decimal');
  const [data,      setData]      = useState(null);
  const [status,    setStatus]    = useState('loading');
  const [error,     setError]     = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice,    setNotice]    = useState(null);
  const [copiedDay, setCopiedDay] = useState(null);
  const closeRef = useRef(null);

  // Esc closes; focus the close button on open and restore focus on close
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    fetchTimesheet(project.id, month)
      .then(d  => { if (!cancelled) { setData(d); setStatus('ready'); } })
      .catch(e => { if (!cancelled) { setError(e.message); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [project.id, month, reloadKey]);

  // Clear transient feedback after 2 s
  useEffect(() => {
    if (!notice && !copiedDay) return;
    const id = setTimeout(() => { setNotice(null); setCopiedDay(null); }, 2000);
    return () => clearTimeout(id);
  }, [notice, copiedDay]);

  const handleFormat = (value) => {
    setFormat(value);
    localStorage.setItem(FORMAT_KEY, value);
  };

  const handleCopyMonth = async () => {
    const ok = await copyText(toTSV(data.days, format));
    setNotice(ok ? `Copied ${data.days.length} days` : COPY_FAILED);
  };

  const handleCopyDay = async (day) => {
    const ok = await copyText(formatHours(day.hours, format));
    if (ok) setCopiedDay(day.date);
    else setNotice(COPY_FAILED);
  };

  const handleDownload = () => {
    const blob = new Blob([toCSV(data.days, format)], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = fileName(project.name, month);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isCurrent = month === currentMonth();
  const ready     = status === 'ready' && data;
  const [y, m]    = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div
      onClick={onClose}
      style={{
        position:       'fixed',
        inset:          0,
        background:     'rgba(0,0,0,0.4)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        zIndex:         1000,
        padding:        16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="timesheet-title"
        onClick={e => e.stopPropagation()}
        style={{
          width:         '100%',
          maxWidth:      520,
          maxHeight:     '85vh',
          display:       'flex',
          flexDirection: 'column',
          background:    'var(--card)',
          border:        '1px solid var(--border)',
          borderRadius:  4,
          color:         'var(--text)',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>TIMESHEET</div>
              <h2 id="timesheet-title" style={{ fontSize: 18, fontWeight: 600 }}>{project.name}</h2>
            </div>
            <button
              ref={closeRef}
              onClick={onClose}
              aria-label="Close timesheet"
              style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 16, cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month" style={navButton(false)}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, minWidth: 120, textAlign: 'center' }}>{monthLabel}</span>
            <button
              onClick={() => !isCurrent && setMonth(shiftMonth(month, 1))}
              disabled={isCurrent}
              aria-label="Next month"
              style={navButton(isCurrent)}
            >›</button>
            <div style={{ flex: 1 }} />
            <FormatToggle format={format} onChange={handleFormat} />
          </div>

          {ready && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 10 }}>
              Last synced: {data.last_synced_at
                ? new Date(data.last_synced_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'never'}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {status === 'loading' && (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>Loading...</div>
          )}

          {status === 'error' && (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--danger)' }}>
              {error}
              <div style={{ marginTop: 12 }}>
                <button onClick={() => setReloadKey(k => k + 1)} style={actionButton(false)}>Retry</button>
              </div>
            </div>
          )}

          {ready && data.weeks.map(week => (
            <React.Fragment key={week.start}>
              {week.days.map(day => {
                const weekend = day.in_month && day.weekday >= 6;
                const label   = new Date(`${day.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
                const value   = formatHours(day.hours, format);
                return (
                  <div
                    key={day.date}
                    style={{
                      display:      'flex',
                      alignItems:   'center',
                      padding:      '5px 20px',
                      fontSize:     12,
                      background:   weekend ? 'var(--surface)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                      color:        !day.in_month || day.hours === 0 ? 'var(--muted)' : 'var(--text)',
                      opacity:      day.in_month ? 1 : 0.45,
                    }}
                  >
                    <span style={{ width: 110 }}>{label}</span>
                    <span style={{ flex: 1, color: 'var(--muted)' }}>{day.date}</span>
                    {copiedDay === day.date && (
                      <span style={{ fontSize: 11, color: 'var(--accent)', marginRight: 8 }}>Copied</span>
                    )}
                    {day.in_month ? (
                      <button
                        onClick={() => handleCopyDay(day)}
                        title="Copy value"
                        style={{
                          background:         'none',
                          border:             'none',
                          padding:            0,
                          minWidth:           48,
                          textAlign:          'right',
                          fontSize:           12,
                          fontWeight:         day.hours === 0 ? 400 : 600,
                          fontVariantNumeric: 'tabular-nums',
                          color:              'inherit',
                          cursor:             'pointer',
                        }}
                      >
                        {value}
                      </button>
                    ) : (
                      // Neighbouring-month day: shown for the week subtotal only, not copyable
                      <span
                        aria-disabled="true"
                        title="Other month — not included in this month"
                        style={{ minWidth: 48, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {value}
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Weekly subtotal (display-only, full Monday–Sunday week) */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                padding:      '6px 20px',
                background:   'var(--surface)',
                borderTop:    '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)' }}>
                    Week {week.week} · {shortDate(week.start)} – {shortDate(week.end)}
                  </div>
                  {week.spans_other_month && (
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>incl. days from other month</div>
                  )}
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
                  {formatHours(week.hours, format)}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border)' }}>
          {ready && (
            <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              <span style={{ flex: 1 }}>Total</span>
              <span style={{ color: 'var(--accent)', fontVariantNumeric: 'tabular-nums' }}>{formatHours(data.total, format)}</span>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span role="status" style={{ flex: 1, fontSize: 11, color: notice === COPY_FAILED ? 'var(--danger)' : 'var(--accent)' }}>
              {notice}
            </span>
            <button onClick={handleCopyMonth} disabled={!ready} style={actionButton(!ready)}>Copy month</button>
            <button onClick={handleDownload} disabled={!ready} style={actionButton(!ready)}>Download CSV</button>
          </div>
        </div>
      </div>
    </div>
  );
}
