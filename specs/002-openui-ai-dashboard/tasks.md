---

description: "Task list for OpenUI AI-Generated Dashboard (002-openui-ai-dashboard)"
---

# Tasks: OpenUI AI-Generated Dashboard

**Input**: Design documents from `/specs/002-openui-ai-dashboard/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Last updated**: 2026-06-09 — Phase 9 added for streaming completion reliability (clarification session)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ollama container, Docker Compose infrastructure, and API image preparation

- [x] T001 Create Ollama Docker service with auto-pull entrypoint: `ollama/Dockerfile` and `ollama/entrypoint.sh`
- [x] T002 Add `ollama` service and `ollama_data` named volume to `docker-compose.yml`
- [x] T003 Add `api_data` named volume to `docker-compose.yml` and mount at `/app/data` in the `api` service

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Declaration file, API service core, and route registration — all user story phases depend on this

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create `api/dashboard.declaration.md` — plain-language prose declaration (baked into image as default)
- [x] T005 Update `api/Dockerfile` — add `COPY dashboard.declaration.md ./` and `RUN mkdir -p /app/data` for runtime override volume
- [x] T006 [P] Implement `readDeclaration()` (checks override path first, falls back to baked-in), `computeDeclarationHash()`, and `DEFAULT_DECLARATION` fallback in `api/src/services/ai-dashboard.js`
- [x] T007 [P] Implement `parseThresholds()` (regex extraction from plain-prose declaration) and `getThresholds()` export in `api/src/services/ai-dashboard.js`
- [x] T008 [P] Implement `updateDeclaration()` export — writes to `api_data` volume path and calls `invalidateAICache()` in `api/src/services/ai-dashboard.js`
- [x] T009 [P] Implement `checkOllamaStatus()`, `isCached()`, and `invalidateAICache()` in `api/src/services/ai-dashboard.js`
- [x] T010 Implement `streamFromOllama()` with TCP chunk boundary buffer accumulation (buffer split on `\n`, partial lines held across `reader.read()` calls) in `api/src/services/ai-dashboard.js`
- [x] T011 Implement `generateOrCachedLayout()` with pre-sorted `in_progress` project filter, cache hit fast-path, and empty-response cache-skip guard in `api/src/services/ai-dashboard.js`
- [x] T012 Implement `debugInfo()` diagnostic export in `api/src/services/ai-dashboard.js`
- [x] T013 Register all AI dashboard routes (`GET /status`, `GET /config`, `PUT /declaration`, `GET /` SSE stream, `GET /debug`) in `api/src/routes/ai-dashboard.js`
- [x] T014 Call `invalidateAICache()` after `runFullSync()` in `POST /sync` handler in `api/src/routes/projects.js`

**Checkpoint**: Foundation ready — Ollama reachable, declaration readable and updateable, cache invalidated on sync

---

## Phase 3: User Story 1 — Toggle Between Legacy and AI Dashboard (Priority: P1) 🎯 MVP

**Goal**: A user can switch between the existing legacy dashboard and the AI dashboard from the navigation bar. The toggle is disabled or shows "unavailable" when Ollama is not ready. Preference persists in localStorage.

**Independent Test**: Load the app → confirm legacy view is default → click AI Dashboard toggle → confirm view switches without full page reload → click toggle again → legacy view is restored exactly as before.

- [x] T015 [US1] Create `DashboardToggle` component with Ollama status indicator (ready / pulling / unavailable states) in `frontend/src/components/DashboardToggle.jsx`
- [x] T016 [US1] Add `fetchAIStatus()` polling helper to `frontend/src/hooks/api.js`
- [x] T017 [US1] Add `aiMode`, `aiStatus`, `aiReloadKey`, and localStorage persistence to `frontend/src/App.jsx`; call `setAiReloadKey(k => k + 1)` after manual sync to remount AI dashboard
- [x] T018 [US1] Render `DashboardToggle` in navigation bar; conditionally render `<AIDashboard key={aiReloadKey} />` vs legacy project list in `frontend/src/App.jsx`

**Checkpoint**: Toggle switches views in < 1 s; AI unavailable state shows correct indicator; legacy dashboard passes all existing checks unchanged

---

## Phase 4: User Story 2 — AI-Generated Project Overview (Priority: P2)

**Goal**: The AI dashboard displays all in_progress projects as progressively streaming project cards and burndown charts. Status badges reflect budget health using thresholds read from the declaration file at runtime.

**Independent Test**: Switch to AI dashboard → at least one ProjectCard appears within 10 s → BurndownChart renders below it → StatusBadge reflects the correct on-budget / at-risk / over-budget state based on declaration thresholds.

- [x] T019 [P] [US2] Create `AIDashboardContext.jsx` — React context providing `projects`, `theme`, and `thresholds` (default: `{ atRisk: 80, overBudget: 100 }`) at `frontend/src/components/ai/AIDashboardContext.jsx`
- [x] T020 [P] [US2] Implement `StatusBadge.jsx` using InvoiceNinja design tokens (`success: #36c157`, `warning: #e27329`, `danger: #da4830`) at `frontend/src/components/ai/StatusBadge.jsx`
- [x] T021 [P] [US2] Implement `Dashboard.ai.jsx` — openUI Lang required root container; renders children array via `renderNode` at `frontend/src/components/ai/Dashboard.ai.jsx`
- [x] T022 [P] [US2] Implement `ProjectCard.ai.jsx` — reads `thresholds` from context (not hardcoded), embeds `StatusBadge`, renders name / budget / logged / remaining / progress bar at `frontend/src/components/ai/ProjectCard.ai.jsx`
- [x] T023 [P] [US2] Implement `BurndownChart.ai.jsx` — ideal vs. actual burndown lines via `GET /api/projects/:id/burndown` at `frontend/src/components/ai/BurndownChart.ai.jsx`
- [x] T024 [US2] Register `Dashboard` (root), `ProjectCard`, `BurndownChart`, `StatusBadge` in component library in `frontend/src/components/ai/components.js`
- [x] T025 [US2] Add `fetchAIDashboard()` SSE streaming helper and `fetchAIDashboardConfig()` thresholds helper to `frontend/src/hooks/api.js`
- [x] T026 [US2] Implement `AIDashboard.jsx` — fetches thresholds from `GET /config` on mount, streams layout via SSE, handles all status states (loading / streaming / ready / error / unavailable / empty), provides `AIDashboardContext` at `frontend/src/components/ai/AIDashboard.jsx`

**Checkpoint**: AI dashboard streams projects with cards, charts, and declaration-driven status badges; empty, error, and unavailable states all show correct UI

---

## Phase 5: User Story 3 — Declarative Dashboard Configuration (Priority: P3)

**Goal**: An operator edits the plain-language declaration (via `PUT /api/ai-dashboard/declaration` or image rebuild) to change layout ordering or StatusBadge thresholds. The AI dashboard reflects the change on the next load without a code deployment.

**Independent Test**: `PUT` a new declaration with `at-risk >= 70%` → call `GET /api/ai-dashboard/config` → verify `thresholds.atRisk === 70` → reload AI dashboard → verify StatusBadge uses the new threshold and layout follows the new ordering instruction.

- [x] T027 [US3] Confirm `GET /api/ai-dashboard/config` returns `{ thresholds: { atRisk, overBudget } }` parsed from live declaration content in `api/src/routes/ai-dashboard.js`
- [x] T028 [US3] Confirm `PUT /api/ai-dashboard/declaration` writes content to `/app/data/dashboard.declaration.md` (Docker volume), calls `invalidateAICache()`, and next `GET /api/ai-dashboard` generates a fresh layout in `api/src/routes/ai-dashboard.js`
- [x] T029 [US3] Confirm `readDeclaration()` in `api/src/services/ai-dashboard.js` checks `/app/data/dashboard.declaration.md` (volume override) first, falls back to baked-in `/app/dashboard.declaration.md`
- [x] T030 [US3] Confirm layout cache key is SHA-256 of declaration content — changing declaration content via PUT produces a hash mismatch → cache miss → fresh Ollama generation in `api/src/services/ai-dashboard.js`

**Checkpoint**: Declaration edit → config endpoint reflects new thresholds → next dashboard load uses new layout; volume override confirmed; fallback to baked-in default when volume file absent

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Specification alignment, documentation accuracy, and artifact currency

- [x] T031 Update `specs/002-openui-ai-dashboard/spec.md` — FR-004/SC-005 add Dashboard component; FR-009 updated to server-side threshold parsing; Key Entities updated
- [x] T032 [P] Update `specs/002-openui-ai-dashboard/plan.md` — component list (four), declaration path (`api/`), remove `@openuidev/react-headless`, add `Dashboard.ai.jsx` to project structure
- [x] T033 [P] Update `specs/002-openui-ai-dashboard/research.md` — Decision 1: remove react-headless; Decision 6: updated declaration location and runtime override via volume + PUT endpoint
- [x] T034 [P] Update `specs/002-openui-ai-dashboard/data-model.md` — Dashboard in registry table, thresholds in context, override path, AIDashboardContext section, updated runtime state table
- [x] T035 [P] Rewrite `specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md` — openUI Lang function-call grammar (not HTML tags), add `GET /config`, `PUT /declaration`, `GET /debug` endpoint contracts
- [x] T036 [P] Update `specs/002-openui-ai-dashboard/quickstart.md` — PUT endpoint for runtime declaration edits, correct component list, updated cache-invalidation and troubleshooting instructions
- [x] T037 [P] Update `README.md` — fix declaration file path to `api/`, component table uses openUI Lang syntax, add `GET /config` / `PUT /declaration` / `GET /debug` to API endpoints section
- [x] T038 Regenerate `specs/002-openui-ai-dashboard/tasks.md` to reflect current implementation and spec state (this file)

---

## Phase 7: Clarification 2026-06-09 — Deleted/Archived Project Filtering (FR-012)

**Goal**: Deleted (`is_deleted: true`) and archived (`archived_at IS NOT NULL`) projects must not appear in either the standard or AI dashboard.

- [x] T039 Add `WHERE NOT COALESCE((p.raw->>'is_deleted')::boolean, false) AND p.archived_at IS NULL` filter to `listProjectsWithStats()` in `api/src/services/burndown.js` (covers both legacy and AI dashboard since both call this function)
- [x] T040 [P] Update `specs/002-openui-ai-dashboard/spec.md` — add clarification to Session 2026-06-09, add FR-012, add edge case for deleted/archived projects

---

## Phase 8: Clarification 2026-06-09 — GitHub Actions CI/CD Pipeline (FR-013)

**Goal**: Replace local Docker image builds with a GitHub Actions workflow that builds and pushes all custom service images to `ghcr.io` on every push to `master`, then calls the Portainer stack webhook to trigger an immediate redeploy. Local builds are preserved via a `docker-compose.dev.yml` overlay for developer validation.

**Independent Test**: Push a commit to `master` → GitHub Actions workflow runs and all four image build jobs succeed → images appear in `ghcr.io/marrothm/` → Portainer webhook is called → Portainer redeploys the stack with the new image. Local: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build` starts the stack using locally built images.

- [x] T041 Update `docker-compose.yml` — remove `build:` stanzas from `postgres`, `api`, `worker`, `frontend`, `ollama` services; change all `image:` values to `ghcr.io/marrothm/burndown-<service>:latest`; change `pull_policy: never` to `pull_policy: always`
- [x] T042 [P] Create `docker-compose.dev.yml` — overlay file restoring `build:` context and `pull_policy: build` for `postgres` (`context: .`, `dockerfile: postgres/Dockerfile`), `ollama` (`context: ./ollama`), `api` (`context: ./api`), `worker` (`context: ./api`), and `frontend` (`context: ./frontend`) services
- [x] T043 [P] Create `.github/workflows/build-and-push.yml` — GHA workflow triggered on `push` to `master`; authenticates to `ghcr.io` using `GHCR_TOKEN` secret; builds and pushes `burndown-postgres` (context `./postgres`), `burndown-ollama` (context `./ollama`), `burndown-api` (context `./api`), `burndown-frontend` (context `./frontend`) images tagged `latest`; final step: `curl -X POST "${{ secrets.PORTAINER_WEBHOOK_URL }}"` to trigger Portainer redeploy
- [x] T044 [P] Update `README.md` — add CI/CD section documenting: required GitHub secrets (`GHCR_TOKEN` with `write:packages` scope, `PORTAINER_WEBHOOK_URL`), deployment flow (push to master → GHA → ghcr.io → Portainer webhook), and local dev instructions (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`)

**Checkpoint**: `docker-compose.yml` has no `build:` stanzas; `docker-compose.dev.yml` overlay restores local builds; GHA workflow pushes all 4 images and fires Portainer webhook on every master push

---

## Phase 9: Clarification 2026-06-09 — Streaming Completion Reliability (FR-003, SC-007)

**Goal**: Fix the persistent bug where the AI dashboard does not render unless a manual page reload is performed. Enforce the streaming state machine contracts defined in the 2026-06-09 clarification session: localStorage-restore auto-trigger, explicit done sentinel as sole completion signal, stall detection, and empty-response error state.

**Independent Test**: With AI dashboard mode set in localStorage → reload page → AI dashboard MUST begin streaming automatically (no toggle click required). After streaming completes (`data: [DONE]` received) → full layout MUST appear without any user action. Close SSE connection mid-stream without `[DONE]` → error state MUST appear (not a blank screen). Receive `[DONE]` with 0 components parsed → error + retry button MUST appear. Simulate 15-second token silence → stall prompt MUST appear while partial layout remains visible.

- [x] T045 [US1] Update `AIDashboard.jsx` — on component mount, read `burndown_dashboard_mode` from localStorage; if value is `'ai'`, immediately call `startStreaming()` (identical path to toggle-click); this fixes the reload-required bug at `frontend/src/components/ai/AIDashboard.jsx`
- [x] T046 [US2] Update `AIDashboard.jsx` — enforce sentinel-as-sole-ready-trigger: transition to `ready` ONLY on `data: [DONE]` event; SSE `onerror` / connection close without prior `[DONE]` MUST transition to `error` state with message "Generation incomplete — connection lost" at `frontend/src/components/ai/AIDashboard.jsx`
- [x] T047 [US2] Update `AIDashboard.jsx` — implement stall detection: reset a `setTimeout(15000)` on every received SSE token; if the timer fires before cancellation, transition to `stalled` status and render a non-destructive "Generation seems stuck — retry?" prompt; cancel the timer on `[DONE]` receipt or connection close at `frontend/src/components/ai/AIDashboard.jsx`
- [x] T048 [US2] Update `AIDashboard.jsx` — empty-response guard after `[DONE]`: if accumulated response parses to 0 renderable components, transition to `error` status and render "Dashboard generation failed — retry" with a retry button; do not render a blank dashboard or silently fall back to legacy at `frontend/src/components/ai/AIDashboard.jsx`

**Checkpoint**: Page reload with AI mode in localStorage → AI dashboard auto-streams; `[DONE]` → full layout appears without reload; connection drop → error (not blank); 0 components → error + retry; 15-second silence → stall prompt with partial layout preserved

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — blocks all user story phases
- **US1 Toggle (Phase 3)**: Depends on Phase 2 completion
- **US2 AI Dashboard (Phase 4)**: Depends on Phase 2 completion; independent of US1 for implementation, needs US1 for end-to-end browser testing
- **US3 Declarative Config (Phase 5)**: Depends on Phase 2 service layer (T006–T012); no dependency on US1/US2 frontend work
- **Polish (Phase 6)**: All implementation phases complete
- **FR-012 Filtering (Phase 7)**: Can be applied independently; no dependency on Phase 3–6
- **CI/CD Pipeline (Phase 8)**: Independent of Phase 3–7 feature work; depends only on Phase 1 (docker-compose.yml exists); T042, T043, T044 are parallel; T041 can also run in parallel with T042–T044 (different files)
- **Streaming Reliability (Phase 9)**: Depends on Phase 4 (AIDashboard.jsx must exist); T045–T048 are sequential (same file); T045 is the highest-priority fix (resolves the reload-required bug)

### User Story Dependencies

- **US1 (P1)**: Requires Phases 1 + 2 only
- **US2 (P2)**: Requires Phases 1 + 2; integrates with US1 for end-to-end browser testing
- **US3 (P3)**: Requires Phase 2 service layer; declaration config is exercised by US2 frontend when rendering

### Parallel Opportunities

- T006, T007, T008, T009 in Phase 2 can run in parallel (distinct functions in the service file)
- T019, T020, T021, T022, T023 in Phase 4 can run in parallel (separate component files)
- T031–T037 in Phase 6 can run in parallel (separate documentation files)

---

## Parallel Example: Phase 4 (User Story 2)

```bash
# Launch all AI component implementations in parallel (separate files, no dependencies):
Task T019: "Implement AIDashboardContext.jsx"
Task T020: "Implement StatusBadge.jsx"
Task T021: "Implement Dashboard.ai.jsx"
Task T022: "Implement ProjectCard.ai.jsx"
Task T023: "Implement BurndownChart.ai.jsx"
# After all parallel tasks complete:
Task T024: "Register all four components in components.js"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T014)
3. Complete Phase 3: User Story 1 — Toggle (T015–T018)
4. **STOP and VALIDATE**: Toggle switches views; AI unavailable state shows correctly; legacy dashboard unchanged

### Incremental Delivery

1. Setup + Foundational → Core AI service functional
2. US1 → Toggle visible; AI dashboard placeholder mounted
3. US2 → Full streaming dashboard: cards, charts, status badges
4. US3 → Declaration-driven config + runtime updates via PUT endpoint
5. Polish → Documentation and spec alignment complete
6. CI/CD Pipeline (Phase 8) → GHA builds and pushes images; Portainer redeploys on every master push
7. Streaming Reliability (Phase 9) → T045 fixes reload bug; T046–T048 harden sentinel, stall detection, and empty-response handling

---

## Notes

- [P] tasks = different files with no in-phase dependencies; safe to run in parallel
- [Story] label maps task to specific user story for traceability
- openUI Lang uses function-call syntax (`card = ProjectCard(1)`), **not** HTML tag syntax
- StatusBadge thresholds are **not** hardcoded — they come from the declaration via `GET /api/ai-dashboard/config` (FR-009)
- Declaration default is baked into the Docker image; runtime override via `api_data` volume + `PUT /api/ai-dashboard/declaration` (FR-005 / SC-004)
- Projects are pre-sorted server-side by `progress` descending before being sent to Ollama — the model cannot be relied upon to sort correctly
- Phase 8 CI/CD: `docker-compose.yml` has no `build:` stanzas (Portainer uses pre-built ghcr.io images); local dev uses `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`; GitHub secrets `GHCR_TOKEN` and `PORTAINER_WEBHOOK_URL` must be configured in the repository settings before T043 can be exercised
