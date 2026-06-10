# Implementation Plan: OpenUI AI-Generated Dashboard

**Branch**: `002-openui-ai-dashboard` | **Date**: 2026-06-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/002-openui-ai-dashboard/spec.md`

## Summary

Add a locally-hosted AI-generated dashboard alongside the existing React dashboard.
The operator writes a plain-language prose declaration file; an Ollama container running
`qwen2.5:7b` generates the dashboard layout using openUI Lang, composing it from four
registered React components (Dashboard, ProjectCard, BurndownChart, StatusBadge). A
toggle in the navigation switches between the legacy and AI-generated views. The AI
response is cached in memory and invalidated only when the declaration file changes.
The declaration is updateable at runtime via `PUT /api/ai-dashboard/declaration`
(persisted to a named Docker volume; no image rebuild required).

## Technical Context

**Language/Version**: JavaScript (ESM) — Node.js 22 (API), React 18 (frontend)

**Primary Dependencies**:
- `@openuidev/react-lang` — openUI Lang parser and renderer (frontend)
- `ollama/ollama` Docker image — local LLM runtime (new container)
- `qwen2.5:7b` — AI model pulled automatically on first Ollama startup
- Native `EventSource` — SSE streaming (no extra npm package needed)

**Storage**: In-memory Map (ephemeral, API process lifetime) for layout cache; no DB changes

**Testing**: Vitest (existing, API unit tests); React Testing Library (frontend component tests)

**Target Platform**: Docker Compose stack (same as existing); browser (Chrome, Firefox, Safari)

**Project Type**: Enhancement to existing web application — new service (Ollama) +
new API route + new frontend view alongside unchanged legacy view

**Performance Goals**:
- First streamed component: ≤ 10 s on local network (SC-002)
- Cached layout load: ≤ 500 ms (SC-002)
- Toggle switch: ≤ 1 s (SC-001)
- Stall prompt visible: ≤ 1 s after 15-second no-token threshold (SC-007)

**Streaming State Machine Constraints** (Clarified 2026-06-09):
- `ready` state MUST only be entered on receipt of explicit `data: [DONE]` sentinel —
  never on connection close or silence timeout alone (FR-003)
- On page load, if `burndown_dashboard_mode = 'ai'` is set in localStorage, the frontend
  MUST auto-initiate streaming immediately — identical to a toggle click (User Story 1 AS-4)
- Stall detection: if no new SSE token arrives within 15 s of the last token, transition to
  `stalled` state and show a non-destructive retry prompt while preserving partial layout (SC-007)
- Empty-response: if `[DONE]` is received with 0 parsed components, show error + retry button
- Sentinel-drop: if SSE connection closes without `[DONE]`, transition to `error` (incomplete)

**Constraints**:
- No external AI API calls — Ollama runs on the internal Docker network only
- Frontend MUST NOT call Ollama directly — all AI requests go through Fastify API
  (Principle III: Layered Service Architecture)
- Only Dashboard, ProjectCard, BurndownChart, StatusBadge components may be rendered (FR-004)
- qwen2.5:7b requires ~8 GB RAM headroom on the host
- Local image builds (`docker build`) are NOT the deployment path — GHA builds and publishes
  all custom images (FR-013); `docker compose up --build` is for local dev/validation only

**CI/CD Pipeline**:
- Workflow file: `.github/workflows/build-and-push.yml`
- Trigger: push to `master` branch
- Builds: `burndown-postgres`, `burndown-ollama`, `burndown-api`, `burndown-frontend`
  (worker reuses the api image; redis uses the official upstream image — not rebuilt)
- Registry: `ghcr.io/marrothm/<image>:latest`
- Post-push: calls `PORTAINER_WEBHOOK_URL` secret to trigger immediate Portainer stack redeploy
- Required GitHub secrets: `GHCR_TOKEN` (registry push auth), `PORTAINER_WEBHOOK_URL`
- `docker-compose.yml` for Portainer: references `ghcr.io/marrothm/` images with `pull_policy: always`; no `build:` stanzas
- `docker-compose.dev.yml` (overlay): restores `build:` contexts for local developer validation

**Scale/Scope**: One new Docker service, one new API route, one new frontend view,
one declaration file, one GHA workflow. Existing services, database schema, and legacy dashboard untouched.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | Ollama on internal network; no external AI calls; openUI component restriction prevents arbitrary HTML injection |
| II. InvoiceNinja Is the Single Source of Truth | ✅ Pass | AI reads project data from existing API endpoints; no new data store; no InvoiceNinja API changes |
| III. Layered Service Architecture | ✅ Pass | Frontend → Fastify API → Ollama (no layer bypass); new `ollama` service has single responsibility |
| IV. Security Hygiene | ✅ Pass | openUI restricts output to registered components (no XSS vector); Ollama isolated on internal network; no new prod deps with known CVEs; GHA secrets (`GHCR_TOKEN`, `PORTAINER_WEBHOOK_URL`) kept in GitHub repo secrets — never in source |
| V. Simplicity & Observable Configuration | ✅ Pass | YAGNI — all additions required by spec; InvoiceNinja design tokens applied to StatusBadge and AI dashboard chrome; Docker Compose remains canonical local method (dev overlay); GHA is the production deployment transport (no constitution conflict — see Complexity Tracking) |

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
api/dashboard.declaration.md                  # New: plain-language prose dashboard config (baked into image; runtime override via api_data volume)

.github/
└── workflows/
    └── build-and-push.yml                    # New: build & push all custom images to ghcr.io on push to master; call Portainer webhook

docker-compose.yml                            # Updated: add ollama service + ollama_data volume; reference ghcr.io images; pull_policy: always (no build stanzas)
docker-compose.dev.yml                        # New: local dev overlay — restores build: contexts for docker compose -f ... --build
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
│   │       ├── AIDashboardContext.jsx        # New: React context providing projects, theme, thresholds
│   │       ├── components.js                 # New: openUI component registry (root: Dashboard)
│   │       ├── Dashboard.ai.jsx              # New: openUI root container (required by openUI Lang)
│   │       ├── ProjectCard.ai.jsx            # New: openUI-registered ProjectCard (embeds StatusBadge)
│   │       ├── BurndownChart.ai.jsx          # New: openUI-registered BurndownChart variant
│   │       └── StatusBadge.jsx               # New: on-budget / at-risk / over-budget indicator
│   └── hooks/
│       └── api.js                            # Updated: add fetchAIDashboard(), fetchAIDashboardConfig()
└── package.json                              # Updated: @openuidev/react-lang
```

**Structure Decision**: Web application additive enhancement. No existing files are deleted.
The legacy dashboard path is fully preserved; all AI-dashboard files are isolated under
`frontend/src/components/ai/`.

## Complexity Tracking

**FR-013 — GHA CI/CD / split compose files**: The constitution's Development Workflow
requires "Docker-first validation via `docker compose up -d --build`" for local validation
and also states "Docker Compose MUST be the canonical local deployment method." These remain
satisfied: the `docker-compose.dev.yml` overlay preserves local build capability for
developer validation. The production `docker-compose.yml` (used by Portainer) references
pre-built `ghcr.io` images — this is a deployment transport change, not a contradiction of
the local-first principle. The split compose approach is the standard pattern for this exact
workflow and requires no constitution amendment.
