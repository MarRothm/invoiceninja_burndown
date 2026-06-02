# Implementation Plan: OpenUI AI-Generated Dashboard

**Branch**: `002-openui-ai-dashboard` | **Date**: 2026-06-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-openui-ai-dashboard/spec.md`

## Summary

Add a locally-hosted AI-generated dashboard alongside the existing React dashboard.
The operator writes a plain-language prose declaration file; an Ollama container running
`qwen2.5:7b` generates the dashboard layout using openUI Lang, composing it from three
registered React components (ProjectCard, BurndownChart, StatusBadge). A toggle in the
navigation switches between the legacy and AI-generated views. The AI response is cached
in memory and invalidated only when the declaration file changes.

## Technical Context

**Language/Version**: JavaScript (ESM) — Node.js 22 (API), React 18 (frontend)

**Primary Dependencies**:
- `@openuidev/react-lang` — openUI Lang parser, renderer, system-prompt generator (frontend)
- `@openuidev/react-headless` — streaming chat state management (frontend)
- `ollama/ollama` Docker image — local LLM runtime (new container)
- `qwen2.5:7b` — AI model pulled automatically on first Ollama startup

**Storage**: In-memory Map (ephemeral, API process lifetime) for layout cache; no DB changes

**Testing**: Vitest (existing, API unit tests); React Testing Library (frontend component tests)

**Target Platform**: Docker Compose stack (same as existing); browser (Chrome, Firefox, Safari)

**Project Type**: Enhancement to existing web application — new service (Ollama) +
new API route + new frontend view alongside unchanged legacy view

**Performance Goals**:
- First streamed component: ≤ 10 s on local network (SC-002)
- Cached layout load: ≤ 500 ms (SC-002)
- Toggle switch: ≤ 1 s (SC-001)

**Constraints**:
- No external AI API calls — Ollama runs on the internal Docker network only
- Frontend MUST NOT call Ollama directly — all AI requests go through Fastify API
  (Principle III: Layered Service Architecture)
- Only ProjectCard, BurndownChart, StatusBadge components may be rendered (FR-004)
- qwen2.5:7b requires ~8 GB RAM headroom on the host

**Scale/Scope**: One new Docker service, one new API route, one new frontend view,
one declaration file. Existing services, database schema, and legacy dashboard untouched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | Ollama on internal network; no external AI calls; openUI component restriction prevents arbitrary HTML injection |
| II. InvoiceNinja Is the Single Source of Truth | ✅ Pass | AI reads project data from existing API endpoints; no new data store; no InvoiceNinja API changes |
| III. Layered Service Architecture | ✅ Pass | Frontend → Fastify API → Ollama (no layer bypass); new `ollama` service has single responsibility |
| IV. Security Hygiene | ✅ Pass | openUI restricts output to registered components (no XSS vector); Ollama isolated on internal network; no new prod deps with known CVEs |
| V. Simplicity & Observable Configuration | ✅ Pass | YAGNI — all additions required by spec; InvoiceNinja design tokens applied to StatusBadge and AI dashboard chrome |

## Project Structure

### Documentation (this feature)

```text
specs/002-openui-ai-dashboard/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
dashboard.declaration.md                      # New: plain-language prose dashboard config

docker-compose.yml                            # Updated: add ollama service + ollama_data volume
ollama/
└── entrypoint.sh                             # New: auto-pull qwen2.5:7b on first start

api/
├── src/
│   ├── routes/
│   │   ├── projects.js                       # Unchanged
│   │   └── ai-dashboard.js                   # New: SSE streaming endpoint /api/ai-dashboard
│   ├── services/
│   │   ├── burndown.js                       # Unchanged
│   │   ├── sync.js                           # Unchanged
│   │   └── ai-dashboard.js                   # New: declaration reader, cache, Ollama client
│   └── server.js                             # Updated: register ai-dashboard route
└── package.json                              # No new prod deps (uses built-in fetch for Ollama)

frontend/
├── src/
│   ├── App.jsx                               # Updated: add DashboardToggle + AI mode routing
│   ├── components/
│   │   ├── ProjectCard.jsx                   # Unchanged (legacy)
│   │   ├── BurndownChart.jsx                 # Unchanged (legacy)
│   │   ├── ThemeSelector.jsx                 # Unchanged
│   │   ├── DashboardToggle.jsx               # New: toggle button (legacy ↔ AI)
│   │   └── ai/
│   │       ├── AIDashboard.jsx               # New: AI dashboard root; streaming + cache display
│   │       ├── AIDashboardContext.jsx        # New: React context providing projects + theme to AI components
│   │       ├── components.js                 # New: openUI component registry + system prompt
│   │       ├── ProjectCard.ai.jsx            # New: openUI-registered ProjectCard variant
│   │       ├── BurndownChart.ai.jsx          # New: openUI-registered BurndownChart variant
│   │       └── StatusBadge.jsx               # New: on-budget / at-risk / over-budget indicator
│   └── hooks/
│       └── api.js                            # Updated: add fetchAIDashboard() streaming helper
└── package.json                              # Updated: @openuidev/react-lang, @openuidev/react-headless
```

**Structure Decision**: Web application additive enhancement. No existing files are deleted.
The legacy dashboard path is fully preserved; all AI-dashboard files are isolated under
`frontend/src/components/ai/`.

## Complexity Tracking

> No constitution violations to justify.
