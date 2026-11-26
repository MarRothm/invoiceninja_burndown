import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { library } from './components.js';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import { fetchProjects, fetchAIDashboard, fetchAIDashboardConfig } from '../../hooks/api.js';
import TurnoverOverview from '../TurnoverOverview.jsx';
import ProjectCardAI from './ProjectCard.ai.jsx';
import BurndownChartAI from './BurndownChart.ai.jsx';

const TIMEOUT_MS = 30_000;
const STALL_MS   = 15_000; // T047: stall detection — no new token for 15 s

// Same order as the API's displayOrder: hourly by budget consumed, then lump sum by earned %.
function closedOrder(a, b) {
  const lsA = a.billing_mode === 'lump_sum';
  const lsB = b.billing_mode === 'lump_sum';
  if (lsA !== lsB) return lsA ? 1 : -1;
  if (!lsA) return b.progress - a.progress;
  return (b.lump_sum?.earned_pct ?? -1) - (a.lump_sum?.earned_pct ?? -1);
}

// Feature 010: closed projects are not sent to the AI — a fixed section below the generated
// layout, built from the same blocks: card + burndown (BurndownChart shows the project turnover
// for lump-sum projects). Never a timesheet block.
function ClosedProjects({ projects }) {
  const closed = projects.filter(p => p.status === 'closed').sort(closedOrder);
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 24, marginBottom: 12 }}>CLOSED PROJECTS</div>
      {closed.length === 0 && <div style={{ fontSize: 12, color: 'var(--muted)' }}>No closed projects.</div>}
      {closed.map(p => (
        <React.Fragment key={p.id}>
          <ProjectCardAI props={{ projectId: p.id }} />
          <BurndownChartAI props={{ projectId: p.id }} />
        </React.Fragment>
      ))}
    </div>
  );
}

export default function AIDashboard({ theme, ollamaStatus, cached = false, model = 'qwen2.5:7b', showClosed = false, onOpenTimesheet }) {
  const [response, setResponse]   = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus]       = useState('idle'); // idle|loading|streaming|stalled|ready|error|unavailable
  const [errorMsg, setErrorMsg]   = useState('');
  const [projects, setProjects]     = useState([]);
  const [thresholds, setThresholds] = useState({ atRisk: 80, overBudget: 100 });
  const [renderKey, setRenderKey]   = useState(0);

  const closeRef      = useRef(null);
  const timerRef      = useRef(null);
  const stallTimerRef = useRef(null); // T047
  const responseRef   = useRef('');   // T048: sync accumulation for onDone empty-response guard

  // T045: keep a ref to current status so the auto-retry effect can read it
  // without adding status as a dependency (which would cause infinite loops).
  const statusRef = useRef(status);
  statusRef.current = status;

  const load = useCallback(() => {
    if (closeRef.current) closeRef.current();
    clearTimeout(timerRef.current);
    clearTimeout(stallTimerRef.current);

    setResponse('');
    responseRef.current = '';
    setStatus('loading');
    setStreaming(false);
    setErrorMsg('');
    setRenderKey(0);

    timerRef.current = setTimeout(() => {
      if (closeRef.current) closeRef.current();
      setStatus('error');
      setErrorMsg('The AI took too long to respond (>30 s). Try again.');
      setStreaming(false);
    }, TIMEOUT_MS);

    let firstToken = false;

    closeRef.current = fetchAIDashboard({
      onToken: (token) => {
        if (!firstToken) {
          firstToken = true;
          clearTimeout(timerRef.current);
          setStatus('streaming');
          setStreaming(true);
        }
        responseRef.current += token;
        setResponse(prev => prev + token);

        // T047: reset stall timer on every received token
        clearTimeout(stallTimerRef.current);
        stallTimerRef.current = setTimeout(() => setStatus('stalled'), STALL_MS);
      },
      onCached: (layout) => {
        clearTimeout(timerRef.current);
        clearTimeout(stallTimerRef.current);
        responseRef.current = layout;
        setResponse(layout);
        setStatus('ready');
        setStreaming(false);
      },
      onDone: () => {
        clearTimeout(timerRef.current);
        clearTimeout(stallTimerRef.current); // T047: cancel stall timer on completion

        setStreaming(false);

        // T048: empty-response guard — [DONE] with no renderable components is an error
        const accumulated = responseRef.current;
        const hasComponents = /Dashboard|ProjectCard|BurndownChart|TimesheetSummary|ProjectTurnover|TurnoverOverview/.test(accumulated);
        if (!hasComponents || !accumulated.trim()) {
          setStatus('error');
          setErrorMsg('Dashboard generation failed — no components were generated.');
          return;
        }

        // T046: transition to ready ONLY via this [DONE] sentinel path
        setStatus(prev => prev === 'error' ? prev : 'ready');
        // Force Renderer to remount with the complete accumulated response (FR-003)
        setRenderKey(k => k + 1);
      },
      onError: (err) => {
        clearTimeout(timerRef.current);
        clearTimeout(stallTimerRef.current);
        setStreaming(false);
        // T045: AI_UNAVAILABLE maps to the dedicated unavailable state so the
        // auto-retry effect can distinguish it from a generic error.
        if (err.message === 'AI_UNAVAILABLE') {
          setStatus('unavailable');
        } else {
          setStatus('error');
          setErrorMsg(err.message ?? 'Failed to load AI dashboard.');
        }
      },
    });
  }, []);

  // Load projects + declaration thresholds for context once on mount
  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
    fetchAIDashboardConfig().then(cfg => setThresholds(cfg.thresholds)).catch(() => {});
  }, []);

  // T045: Auto-trigger on mount — the AI Dashboard is the only dashboard (feature 009);
  // don't wait for the first ollamaStatus response.
  useEffect(() => {
    load();
    return () => {
      if (closeRef.current) closeRef.current();
      clearTimeout(timerRef.current);
      clearTimeout(stallTimerRef.current);
    };
  }, [load]); // load is stable (useCallback []); fires once on mount

  // T045: Auto-retry when Ollama comes back online after the initial attempt failed.
  // Only retries from dead states (unavailable/error) — does not interrupt active streaming.
  useEffect(() => {
    if (ollamaStatus === 'ready' &&
        (statusRef.current === 'unavailable' || statusRef.current === 'error')) {
      load();
    }
  }, [ollamaStatus, load]);

  // Feature 009: no classic fallback — while still waiting for the first token, show the
  // unavailable message as soon as the status check reports it (instead of after the 30 s
  // timeout). A cached layout is still served by the API, so it is not interrupted.
  // 'checking' (no status response yet) is not a verdict and never triggers this.
  useEffect(() => {
    if (statusRef.current === 'loading' &&
        (ollamaStatus === 'unavailable' || ollamaStatus === 'model_missing') &&
        !cached) {
      if (closeRef.current) closeRef.current();
      closeRef.current = null;
      clearTimeout(timerRef.current);
      clearTimeout(stallTimerRef.current);
      timerRef.current = null;
      stallTimerRef.current = null;
      setStreaming(false);
      setStatus('unavailable');
    }
  }, [ollamaStatus, cached]);

  const contextValue = { projects, theme, thresholds, onOpenTimesheet };

  // ── Unavailable state ──
  if (status === 'unavailable') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
        {ollamaStatus === 'model_missing' ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Model not installed on host Ollama</div>
            <div style={{ fontSize: 12 }}>
              Run on the Docker host:<br />
              <code style={{ fontSize: 11 }}>ollama pull {model}</code>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Host Ollama unreachable</div>
            <div style={{ fontSize: 12 }}>
              Ensure Ollama is running on the Docker host and reachable at OLLAMA_URL<br />
              <code style={{ fontSize: 11 }}>default: http://host.docker.internal:11434</code>
            </div>
          </>
        )}
        <div style={{ fontSize: 11, marginTop: 16 }}>
          The dashboard appears automatically once the AI is available.
        </div>
        {/* Turnover needs no AI — stays visible during an outage (010 Q3) */}
        <div style={{ textAlign: 'left', marginTop: 32 }}>
          <TurnoverOverview />
        </div>
      </div>
    );
  }

  // ── Loading / initialising state ──
  if (status === 'loading') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 12, marginBottom: 8 }}>◈ Generating AI dashboard…</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>First load may take up to 10 seconds</div>
      </div>
    );
  }

  // ── Error state ──
  if (status === 'error') {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 16 }}>{errorMsg}</div>
        <button
          onClick={load}
          style={{
            padding: '8px 16px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  // ── Empty state (ready but response parsed to nothing) ──
  const isActive = status === 'ready' || status === 'streaming' || status === 'stalled';
  if (status === 'ready' && isActive && !response.trim()) {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 14, marginBottom: 16 }}>
          No layout generated. Sync InvoiceNinja data, then retry.
        </div>
        <button
          onClick={load}
          style={{
            padding: '8px 16px', background: 'var(--accent)', color: '#fff',
            border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Streaming / stalled / ready state ──
  return (
    <AIDashboardContext.Provider value={contextValue}>
      <div>
        {/* T047: show generating indicator while streaming, stall prompt while stalled */}
        {(streaming || status === 'stalled') && (
          <div style={{
            fontSize: 11,
            color: 'var(--muted)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            {status === 'stalled' ? (
              <>
                <span>Generation seems stuck —</span>
                <button
                  onClick={load}
                  style={{
                    padding: '2px 8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    fontSize: 11,
                    color: 'var(--accent)',
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◈</span>
                Generating…
              </>
            )}
          </div>
        )}
        {response && (
          <Renderer
            key={renderKey}
            response={response}
            library={library}
            isStreaming={streaming || status === 'stalled'}
            onParseResult={(result) => {
              result?.meta?.errors?.forEach(e => {
                if (e.code !== 'unknown-component') console.warn('[openui]', e);
              });
            }}
          />
        )}
        {showClosed && status === 'ready' && <ClosedProjects projects={projects} />}
      </div>
    </AIDashboardContext.Provider>
  );
}
