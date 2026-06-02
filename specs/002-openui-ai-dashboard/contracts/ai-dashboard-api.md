# Contract: AI Dashboard API

**Feature**: 002-openui-ai-dashboard
**Type**: REST / SSE endpoint contract (consumed by the React frontend)

---

## GET /api/ai-dashboard

Streams the AI-generated dashboard layout as openUI Lang tokens. Returns a cached
layout instantly if the declaration file has not changed since the last generation.

### Request

```
GET /api/ai-dashboard
Accept: text/event-stream
```

No request body or query parameters.

### Response — streaming (cache miss or declaration changed)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: <ProjectCard projectId="1" />\n\n
data: <StatusBadge status="on-budget" />\n\n
data: <BurndownChart projectId="1" />\n\n
...
data: [DONE]\n\n
```

- Each `data:` line contains one openUI Lang token or component tag.
- The stream ends with the sentinel `data: [DONE]`.
- The frontend begins rendering as tokens arrive (progressive display).

### Response — cache hit (instant)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

data: {"cached":true,"layout":"<full openUI Lang string>"}\n\n
data: [DONE]\n\n
```

The frontend renderer handles both streaming and cached responses identically via
the `@openuidev/react-lang` parser.

### Error responses

| Status | Condition | Body |
|--------|-----------|------|
| 503 | Ollama container unreachable | `{"error":"ai_unavailable"}` |
| 504 | Ollama did not respond within 30 s | `{"error":"ai_timeout"}` |
| 500 | Declaration file missing or unreadable | `{"error":"declaration_missing"}` |

---

## GET /api/ai-dashboard/status

Health check for the AI service. Used by the frontend to decide whether to enable
or disable the AI dashboard toggle (FR-010).

### Response

```json
{
  "ollama": "ready" | "unavailable" | "pulling",
  "model": "qwen2.5:7b",
  "cached": true | false
}
```

| Field | Values | Meaning |
|-------|--------|---------|
| `ollama` | `ready` | Ollama is running and model is loaded |
| `ollama` | `pulling` | Model auto-pull is in progress (show "AI initialising…" state) |
| `ollama` | `unavailable` | Ollama container not reachable |
| `model` | string | Model name currently configured |
| `cached` | boolean | Whether a cached layout exists (instant load available) |

The frontend polls this endpoint on page load and when the toggle is activated.

---

## openUI Lang Component Grammar

The AI model produces output conforming to this grammar. The renderer ignores any
tag not in this set.

```
layout     ::= (component | whitespace)*
component  ::= "<" name props "/>"
name       ::= "ProjectCard" | "BurndownChart" | "StatusBadge"
props      ::= (prop)*
prop       ::= name "=" '"' value '"'

ProjectCard props:
  projectId  INTEGER   required   InvoiceNinja project ID

BurndownChart props:
  projectId  INTEGER   required   InvoiceNinja project ID

StatusBadge props:
  status     STRING    required   "on-budget" | "at-risk" | "over-budget"
```

Any output outside this grammar (prose text, unknown tags, raw HTML) is silently
discarded by the renderer. This is the primary XSS defence (SC-005).
