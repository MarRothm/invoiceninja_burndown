---
description: "Task list for OpenUI AI-Generated Dashboard"
---

# Tasks: OpenUI AI-Generated Dashboard

**Input**: Design documents from `specs/002-openui-ai-dashboard/`

**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Not explicitly requested — no test tasks generated.

**Organization**: Tasks grouped by user story to enable independent implementation
and testing of each story. All file paths are relative to the repository root.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ollama container, frontend packages, declaration file, and API skeleton.

- [x] T001 Add `ollama` service with `ollama_data` named volume to `docker-compose.yml`; connect to `internal` network; do NOT expose port 11434 to host
- [x] T002 Create `ollama/entrypoint.sh`: start `ollama serve` in background, wait until `/api/tags` responds HTTP 200, run `ollama pull qwen2.5:7b` if model absent, then foreground the serve process
- [x] T003 [P] Add `OLLAMA_URL=http://ollama:11434` environment variable to the `api` service in `docker-compose.yml`
- [x] T004 [P] Create `dashboard.declaration.md` at repository root with initial plain-prose content (show all projects ordered by budget consumed; add StatusBadge per budget health; show BurndownChart per project)
- [x] T005 [P] Add `@openuidev/react-lang` and `@openuidev/react-headless` to `frontend/package.json` dependencies

**Checkpoint**: Ollama container defined, declaration file present, openUI packages pinned. Ready for foundational work.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: API route skeleton and service module that all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T006 Create `api/src/routes/ai-dashboard.js` as an empty Fastify plugin exporting `aiDashboardRoutes`; register it in `api/src/server.js` under prefix `/api`
- [x] T007 [P] Create `api/src/services/ai-dashboard.js` with module-level skeleton: `declarationCache` (empty Map), `ollamaBaseUrl` (reads `process.env.OLLAMA_URL`), `declarationPath` (absolute path to `dashboard.declaration.md`)

**Checkpoint**: Foundation ready — both user story phases can now begin in parallel.

---

## Phase 3: User Story 1 — Toggle (Priority: P1) 🎯 MVP

**Goal**: A working legacy ↔ AI toggle in the navigation bar, with AI toggle disabled when Ollama is unavailable. The legacy dashboard is completely unaffected.

**Independent Test**: Load app → legacy dashboard shown by default → click toggle → AI dashboard placeholder loads (even if showing "unavailable") → click toggle again → legacy dashboard returns exactly as before.

### Implementation for User Story 1

- [x] T008 [US1] Create `frontend/src/components/DashboardToggle.jsx`: a toggle button that accepts `mode` (`'legacy'|'ai'`), `onToggle` callback, and `aiAvailable` boolean; uses InvoiceNinja design tokens; shows "AI unavailable" indicator when `aiAvailable` is false
- [x] T009 [US1] Implement `GET /api/ai-dashboard/status` in `api/src/routes/ai-dashboard.js`: returns `{ollama, model, cached}` (see contracts/ai-dashboard-api.md for shape)
- [x] T010 [US1] Implement `checkOllamaStatus()` in `api/src/services/ai-dashboard.js`: HTTP GET to `${ollamaBaseUrl}/api/tags`; returns `'ready'|'unavailable'|'pulling'` based on response
- [x] T011 [US1] Create `frontend/src/components/ai/AIDashboard.jsx` placeholder: renders a loading skeleton or "AI initialising…" message; accepts `onUnavailable` prop; no streaming yet
- [x] T012 [US1] Update `frontend/src/App.jsx`: add `aiMode` state (default `false`); persist to `localStorage` key `burndown_dashboard_mode`; poll `GET /api/ai-dashboard/status` on mount; pass result to `DashboardToggle`; conditionally render `<AIDashboard />` or legacy content

**Checkpoint**: Toggle visible and functional. Legacy dashboard zero-regression. AI placeholder shows correct unavailability state.

---

## Phase 4: User Story 2 — AI-Generated Streaming Layout (Priority: P2)

**Goal**: Switching to the AI dashboard shows real AI-generated project cards, burndown charts, and status badges streamed progressively from the local Ollama model.

**Independent Test**: Switch to AI dashboard with Ollama running → within 10 s the first ProjectCard appears → all projects have cards and charts → over-budget projects show danger StatusBadge → cached reload completes in under 500 ms.

### Implementation for User Story 2

- [x] T013 [P] [US2] Create `frontend/src/components/ai/StatusBadge.jsx`: displays `status` prop (`on-budget`/`at-risk`/`over-budget`) as a coloured pill using InvoiceNinja tokens (`#36c157` / `#e27329` / `#da4830`)
- [x] T014 [P] [US2] Create `frontend/src/components/ai/ProjectCard.ai.jsx`: thin openUI wrapper that imports the existing `ProjectCard.jsx`, accepts `projectId` prop, fetches project data from `/api/projects`, and renders the legacy component with the fetched data
- [x] T015 [P] [US2] Create `frontend/src/components/ai/BurndownChart.ai.jsx`: thin openUI wrapper that imports the existing `BurndownChart.jsx`, accepts `projectId` prop, fetches burndown data from `/api/projects/:id/burndown`, and renders the legacy chart component
- [x] T016 [US2] Create `frontend/src/components/ai/components.js`: export `componentRegistry` mapping `{ProjectCard, BurndownChart, StatusBadge}` to their `.ai.jsx` implementations; export `buildSystemPrompt(registry)` that generates the system prompt describing available components to the model (use `@openuidev/react-lang` prompt builder)
- [x] T017 [US2] Add `fetchAIDashboard(onToken, onDone, onError)` to `frontend/src/hooks/api.js`: opens `GET /api/ai-dashboard` as an EventSource; calls `onToken` for each `data:` line; calls `onDone` on `[DONE]` sentinel; calls `onError` on connection failure
- [x] T018 [US2] Implement `readDeclaration()` and `computeDeclarationHash(content)` in `api/src/services/ai-dashboard.js`: read `declarationPath` with `fs.readFile`; return content string and its SHA-256 hex digest
- [x] T019 [US2] Implement `streamFromOllama(declarationContent, projects, onToken)` in `api/src/services/ai-dashboard.js`: builds system prompt + user message from declaration and project list, POST to `${ollamaBaseUrl}/v1/chat/completions` with `stream: true`; call `onToken` for each content delta; throw on non-2xx or after 30 s timeout
- [x] T020 [US2] Implement `generateOrCachedLayout(reply)` in `api/src/services/ai-dashboard.js`: read declaration, compare hash against `declarationCache`; if hit serve cached layout as single SSE event; if miss stream from Ollama via `streamFromOllama`, accumulate, store in cache, pipe tokens to `reply`
- [x] T021 [US2] Implement `GET /api/ai-dashboard` SSE endpoint in `api/src/routes/ai-dashboard.js`: set `Content-Type: text/event-stream`, `Cache-Control: no-cache`; call `generateOrCachedLayout(reply)`; handle 503 (Ollama unavailable), 504 (timeout), 500 (declaration missing) per contracts/ai-dashboard-api.md
- [x] T022 [US2] Update `frontend/src/components/ai/AIDashboard.jsx` to full implementation: call `fetchAIDashboard`; accumulate tokens into `layoutString`; parse with `@openuidev/react-lang` renderer and `componentRegistry`; render components progressively as tokens arrive
- [x] T023 [US2] Add empty-state to `AIDashboard.jsx`: if stream completes with zero components rendered, show "No projects found" message
- [x] T024 [US2] Add 30 s timeout handling and retry button to `AIDashboard.jsx`: if `onError` fires, show error message with "Try again" button that re-triggers `fetchAIDashboard`

**Checkpoint**: Full AI dashboard functional. Streaming visible. Cache confirmed by fast second load. StatusBadge colours correct per budget state.

---

## Phase 5: User Story 3 — Declaration-Driven Layout Changes (Priority: P3)

**Goal**: An operator edits `dashboard.declaration.md` and the next AI dashboard load reflects the change — no code deployment required.

**Independent Test**: Edit `dashboard.declaration.md` (add "show only projects over 50% budget consumed") → reload AI dashboard → AI layout changes to match new instruction → second reload is instant (cache hit on new hash).

### Implementation for User Story 3

- [x] T025 [US3] Add a bind mount for `dashboard.declaration.md` to the `api` service in `docker-compose.yml` so edits on the host take effect without rebuilding the image: `./dashboard.declaration.md:/app/dashboard.declaration.md:ro`
- [x] T026 [US3] Verify cache invalidation end-to-end: confirm that `generateOrCachedLayout` re-reads the file on every request and replaces the cache entry when the hash changes (no additional code needed if T018–T020 are correct; this is a validation task — follow quickstart.md test steps)

**Checkpoint**: Declaration editing workflow confirmed working. Non-developer can change layout without touching code.

---

## Phase N: Polish & Cross-Cutting Concerns

- [x] T027 [P] Add `proxy_buffering off` directive to the `/api/` location block in `frontend/nginx.conf` to ensure SSE tokens reach the browser immediately without Nginx buffering
- [x] T028 [P] Update `frontend/nginx.conf` CSP header to allow `connect-src 'self'` for the EventSource connection to `/api/ai-dashboard` (verify existing CSP covers this; update if needed)
- [x] T029 Run full stack validation per `specs/002-openui-ai-dashboard/quickstart.md`: `docker compose up -d --build` → wait for model pull → open browser → test toggle → test streaming → test cache → test declaration edit; **timing checks**: (a) toggle switch must respond in <1 s (SC-001), (b) second load after first-run must complete in <500 ms (SC-002)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T003, T004, T005 are parallel
- **Foundational (Phase 2)**: Depends on Setup (T001 for docker-compose context) — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — can start as soon as T006 and T007 complete
- **US2 (Phase 4)**: Depends on Phase 2 — T013, T014, T015 can start in parallel with US1
- **US3 (Phase 5)**: Depends on US2 completing (T025 needs T020 correct)
- **Polish (Phase N)**: Depends on all user stories complete

### User Story Dependencies

- **US1**: Can start after Foundational — no dependency on US2 or US3
- **US2**: Can start after Foundational — no dependency on US1; T013–T015 parallel from the start
- **US3**: Depends on US2 completion (validates cache invalidation from T018–T020)

### Within Each User Story

- US1: T008 (toggle component) → T011 (placeholder) → T012 (App.jsx) in parallel with T009 → T010 (API)
- US2: T013/T014/T015 [P] → T016 (registry, needs components) → T017/T018/T019 [P] → T020 (needs T018+T019) → T021 (needs T020) → T022 (needs T017+T021) → T023+T024 [P]

---

## Parallel Example: User Story 2

```
# These three can run simultaneously (different files):
T013: Create StatusBadge.jsx
T014: Create ProjectCard.ai.jsx
T015: Create BurndownChart.ai.jsx

# Once T013+T014+T015 done:
T016: Create components.js registry

# These two can run simultaneously:
T017: Add fetchAIDashboard() to api.js
T018+T019: Add readDeclaration + streamFromOllama to service

# Then sequentially:
T020: generateOrCachedLayout (needs T018+T019)
T021: SSE endpoint (needs T020)
T022: AIDashboard full implementation (needs T016+T017+T021)

# Final two in parallel:
T023: Empty-state handling
T024: Timeout + retry button
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 (toggle + status endpoint + placeholder)
4. **STOP and VALIDATE**: Toggle works, legacy dashboard unchanged, AI mode shows placeholder
5. Deploy/demo toggle as standalone deliverable

### Incremental Delivery

1. Setup + Foundational → structure ready
2. Add US1 → Toggle ships → validate (MVP)
3. Add US2 → Streaming AI layout ships → validate
4. Add US3 → Declaration editing validated → validate
5. Polish → Production-ready

---

## Notes

- [P] tasks = different files, no dependencies between them
- [Story] label maps to spec.md user stories for full traceability
- T002 (entrypoint.sh): make file executable (`chmod +x`) before committing
- T025 (bind mount): use `:ro` (read-only) in the container — only the host writes to the file
- T027 (nginx SSE): `proxy_buffering off` is critical — without it, Nginx buffers the SSE stream and the progressive rendering effect is lost
- Existing `ProjectCard.jsx` and `BurndownChart.jsx` are NEVER modified — only wrapped
