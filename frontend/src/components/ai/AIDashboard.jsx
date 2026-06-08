import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Renderer } from '@openuidev/react-lang';
import { library } from './components.js';
import { AIDashboardContext } from './AIDashboardContext.jsx';
import { fetchProjects, fetchAIDashboard } from '../../hooks/api.js';

const TIMEOUT_MS = 30_000;

export default function AIDashboard({ theme, ollamaStatus }) {
  const [response, setResponse]   = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus]       = useState('idle'); // idle | loading | streaming | ready | error | unavailable
  const [errorMsg, setErrorMsg]   = useState('');
  const [projects, setProjects]   = useState([]);
  const closeRef = useRef(null);
  const timerRef = useRef(null);

  const load = useCallback(() => {
    if (closeRef.current) closeRef.current();
    clearTimeout(timerRef.current);

    setResponse('');
    setStatus('loading');
    setStreaming(false);
    setErrorMsg('');

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
        setResponse(prev => prev + token);
      },
      onCached: (layout) => {
        clearTimeout(timerRef.current);
        setResponse(layout);
        setStatus('ready');
        setStreaming(false);
      },
      onDone: () => {
        clearTimeout(timerRef.current);
        setStatus('ready');
        setStreaming(false);
      },
      onError: (err) => {
        clearTimeout(timerRef.current);
        setStatus('error');
        setErrorMsg(err.message ?? 'Failed to load AI dashboard.');
        setStreaming(false);
      },
    });
  }, []);

  // Load projects for context once on mount
  useEffect(() => {
    fetchProjects().then(setProjects).catch(() => {});
  }, []);

  // Auto-load when component mounts or Ollama comes online
  useEffect(() => {
    if (ollamaStatus === 'ready') {
      load();
    } else if (ollamaStatus === 'unavailable') {
      setStatus('unavailable');
    } else if (ollamaStatus === 'pulling') {
      setStatus('loading');
    }
    return () => {
      if (closeRef.current) closeRef.current();
      clearTimeout(timerRef.current);
    };
  }, [ollamaStatus, load]);

  const contextValue = { projects, theme };

  // ── Unavailable state ──
  if (status === 'unavailable') {
    return (
      <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>◇</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Local AI unavailable</div>
        <div style={{ fontSize: 12 }}>
          Ensure the Ollama container is running:<br />
          <code style={{ fontSize: 11 }}>docker compose up -d ollama</code>
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

  // ── Empty state ──
  const isReady = status === 'ready' || status === 'streaming';
  const isEmpty = isReady && !response.trim();
  if (status === 'ready' && isEmpty) {
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

  // ── Streaming / ready state ──
  return (
    <AIDashboardContext.Provider value={contextValue}>
      <div>
        {streaming && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◈</span>
            Generating…
          </div>
        )}
        {response && (
          <Renderer
            response={response}
            library={library}
            isStreaming={streaming}
            onParseResult={(result) => {
              result?.meta?.errors?.forEach(e => {
                if (e.code !== 'unknown-component') console.warn('[openui]', e);
              });
            }}
          />
        )}
      </div>
    </AIDashboardContext.Provider>
  );
}
