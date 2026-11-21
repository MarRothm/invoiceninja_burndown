# Contract Delta: AI Dashboard API (host Ollama)

**Feature**: 006-host-ollama-instance
**Base contract**: `specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md`

Only the changes are listed here. Everything not mentioned stays as defined in the base contract.

## GET /api/ai-dashboard/status — CHANGED

```json
{
  "ollama": "ready" | "model_missing" | "unavailable",
  "model": "qwen2.5:7b",
  "cached": true | false
}
```

| Field | Value | Meaning |
|-------|-------|---------|
| `ollama` | `ready` | The host Ollama is reachable and has the exact configured model |
| `ollama` | `model_missing` | **New.** The host Ollama is reachable, but the configured model isn't installed. The stack never pulls it; the operator runs `ollama pull <model>` on the host |
| `ollama` | `unavailable` | The host Ollama can't be reached (not running, bound to loopback only, or blocked by a firewall) |
| `ollama` | ~~`pulling`~~ | **Removed.** No longer emitted |

**Consumer rule (frontend)**: enable the AI toggle only when `ollama === "ready"`.

## GET /api/ai-dashboard — CHANGED (error mapping only)

| Status | Condition | Body |
|--------|-----------|------|
| 503 | The host Ollama is unreachable, **or it returns 404 (model not found)** | `{"error":"AI_UNAVAILABLE","status":503}` |
| 504 | Unchanged: no response within 30 s | `{"error":"AI_TIMEOUT","status":504}` |

## GET /api/ai-dashboard/debug — unchanged schema

`ollamaUrl` now defaults to `http://host.docker.internal:11434` and reflects `OLLAMA_URL` (FR-008).

## Environment contract (`.env.example`)

| Variable | Default | Change |
|----------|---------|--------|
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Default changed (was `http://ollama:11434`). Override example: `http://macmini.local:11434` |
| `OLLAMA_MODEL` | `qwen2.5:7b` | Unchanged; must already be installed on the host (`ollama pull qwen2.5:7b`). The stack never pulls it |
