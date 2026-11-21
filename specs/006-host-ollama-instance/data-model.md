# Data Model: Use Host Ollama Instance for the AI Dashboard

**Feature**: 006-host-ollama-instance

This feature adds no persisted data. The only "entities" are runtime configuration and a derived status value.

## AI Service Endpoint (configuration)

| Field | Source | Default | Validation |
|-------|--------|---------|------------|
| `OLLAMA_URL` | env var (`api` service) | `http://host.docker.internal:11434` | Absolute http(s) URL, no trailing slash. Read once at startup. |
| `OLLAMA_MODEL` | env var (`api` service) | `qwen2.5:7b` | Ollama model reference. If it has no `:tag`, it is normalised to `:latest` for matching. |

- Used by: `checkOllamaStatus()`, `streamFromOllama()`, `debugInfo()` in `api/src/services/ai-dashboard.js`.
- The `worker` service doesn't use either variable.

## AI Status (derived, not persisted)

Computed on every `GET /api/ai-dashboard/status` from `GET {OLLAMA_URL}/api/tags` (3 s timeout).

| Value | Condition |
|-------|-----------|
| `ready` | Tags call OK **and** some entry's `name` or `model` equals the normalised `OLLAMA_MODEL` exactly |
| `model_missing` | Tags call OK, but no exact match |
| `unavailable` | Network error, timeout, or non-2xx response |

### State transitions (as seen by the frontend, polled every 15 s)

```text
unavailable ──(host Ollama starts / becomes reachable)──▶ model_missing | ready
model_missing ──(operator runs `ollama pull <model>` on host)──▶ ready
ready ──(host Ollama stops / model removed)──▶ unavailable | model_missing
```

The AI toggle is enabled **only** in `ready`. Moving into `ready` from a failed AI view triggers the existing auto-retry.

## Removed

- Docker volume `ollama_data`, which was created by the old container. Removing it from the host is a manual operator step after upgrading (see quickstart).
