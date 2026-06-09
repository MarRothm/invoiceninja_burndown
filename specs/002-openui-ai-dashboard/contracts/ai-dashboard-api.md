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

data: card1 = ProjectCard(1)\n\n
data:  \n\n
data: chart1 = BurndownChart(1)\n\n
data:  \n\n
data: root = Dashboard([card1, chart1])\n\n
data: [DONE]\n\n
```

- Each `data:` line contains one or more openUI Lang tokens.
- The stream ends with the sentinel `data: [DONE]`.
- The frontend begins rendering as tokens arrive (progressive display).

### Response — cache hit (instant)

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache

data: {"cached":true,"layout":"card1 = ProjectCard(1)\n..."}\n\n
data: [DONE]\n\n
```

The frontend renderer handles both streaming and cached responses identically.

### Error responses

| Status | Condition | Body |
|--------|-----------|------|
| 503 | Ollama container unreachable | `{"error":"AI_UNAVAILABLE","status":503}` |
| 504 | Ollama did not respond within 30 s | `{"error":"AI_TIMEOUT","status":504}` |
| 500 | Internal error | `{"error":"internal_error","status":500}` |

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
| `ollama` | `pulling` | Model auto-pull is in progress |
| `ollama` | `unavailable` | Ollama container not reachable |
| `model` | string | Model name currently configured |
| `cached` | boolean | Whether a cached layout exists (instant load available) |

---

## GET /api/ai-dashboard/config

Returns the thresholds parsed from the current declaration file. The frontend uses
these to compute StatusBadge state in ProjectCard — honouring FR-009 without hardcoding.

### Response

```json
{
  "thresholds": {
    "atRisk": 80,
    "overBudget": 100
  }
}
```

`atRisk` and `overBudget` are integers (percentage points). Defaults are 80 and 100
when the declaration does not specify thresholds.

---

## PUT /api/ai-dashboard/declaration

Updates the dashboard declaration at runtime, persisting it to the `api_data` Docker
volume. Invalidates the layout cache immediately. No image rebuild required (FR-005,
SC-004).

### Request

```
PUT /api/ai-dashboard/declaration
Content-Type: application/json

{ "content": "Show all in_progress projects ordered by budget consumed..." }
```

`content` must be a non-empty string. Maximum length is not enforced but should be kept
under 4 KB for reliable model context window handling.

### Response (success)

```json
{ "ok": true }
```

### Response (error)

```
HTTP/1.1 400 Bad Request

{ "error": "content must be a non-empty string" }
```

---

## GET /api/ai-dashboard/debug

Full diagnostic dump for troubleshooting. Returns Ollama reachability, declaration file
status, project list, and a test Ollama completion. Not intended for production use.

### Response (schema)

```json
{
  "ollamaUrl": "http://ollama:11434",
  "model": "qwen2.5:7b",
  "declarationPath": "/app/dashboard.declaration.md",
  "ollamaStatus": "ready",
  "declarationFound": true,
  "declarationLength": 243,
  "declarationPreview": "Show all in_progress projects...",
  "projectCount": 5,
  "projectIds": [{ "id": 1, "name": "Project A" }],
  "ollamaHttpStatus": 200,
  "ollamaRawResponse": { "choices": [...] },
  "parsedContent": "card1 = ProjectCard(1)..."
}
```

---

## openUI Lang Component Grammar

The AI model produces output conforming to this grammar. The renderer ignores any
name not registered in the component registry.

```
program    ::= (statement "\n")* root_stmt
statement  ::= varName " = " component
root_stmt  ::= "root = Dashboard([" varList "])"
component  ::= compName "(" args ")"
compName   ::= "Dashboard" | "ProjectCard" | "BurndownChart"
args       ::= INTEGER             (for ProjectCard, BurndownChart)
             | "[" varList "]"     (for Dashboard children)
varList    ::= varName ("," " " varName)*
varName    ::= [a-z][a-zA-Z0-9]*

Dashboard  args:  children  ARRAY    required  Array of component variables
ProjectCard args: projectId INTEGER  required  InvoiceNinja project ID
BurndownChart args: projectId INTEGER required InvoiceNinja project ID
```

**Example** (two projects, IDs 1 and 3):

```
card1  = ProjectCard(1)
chart1 = BurndownChart(1)
card3  = ProjectCard(3)
chart3 = BurndownChart(3)
root   = Dashboard([card1, chart1, card3, chart3])
```

Any output outside this grammar (prose text, unknown names, HTML tags) is silently
discarded by the renderer. This is the primary XSS defence (SC-005).

StatusBadge is rendered inline by ProjectCard using declaration-driven thresholds —
it is not a model output target.
