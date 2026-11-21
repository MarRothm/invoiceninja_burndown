# Tasks: Use Host Ollama Instance for the AI Dashboard

**Input**: Design documents from `specs/006-host-ollama-instance/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-dashboard-status.md, quickstart.md

**Tests**: Included. Plan/research R7 calls for Vitest coverage of the status logic, and the constitution requires `test.yml` to stay green.

**Organization**: Tasks are grouped by user story (US1 P1, US2 P2, US3 P3). Paths are relative to the repository root.

**Target**: `macmini.local` (macOS) is both the Docker host and the Ollama host. The model is `qwen2.5:7b`. The default URL is `http://host.docker.internal:11434`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: The user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Confirm the baseline before changing anything.

- [X] T001 Run `cd api && npm test` and record that the existing suite passes before any change (baseline for `api/tests/`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Move the API's default upstream to the host. Every story depends on this.

- [X] T002 In `api/src/services/ai-dashboard.js`, change the module-level default `const ollamaBaseUrl = process.env.OLLAMA_URL ?? 'http://ollama:11434';` to `?? 'http://host.docker.internal:11434'`, and strip any trailing slash: `(process.env.OLLAMA_URL ?? 'http://host.docker.internal:11434').replace(/\/+$/, '')`. Leave `model` (`OLLAMA_MODEL ?? 'qwen2.5:7b'`) unchanged.

**Checkpoint**: The API targets the host by default. The compose changes follow in US1.

---

## Phase 3: User Story 1 — AI Dashboard runs on the host's existing Ollama (Priority: P1) 🎯 MVP

**Goal**: Remove the bundled AI runtime completely and have the `api` container reach the Ollama on the Docker host.

**Independent Test**:
1. On macmini, with `qwen2.5:7b` pulled on the host, run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`.
2. `docker compose ps` lists no `burndown_ollama`.
3. `curl -s localhost:6088/api/ai-dashboard/status` returns `"ollama":"ready"`.
4. The AI Dashboard view streams a layout (quickstart §2–3).

### Implementation for User Story 1

- [X] T003 [US1] Make these changes in `docker-compose.yml`:
  - Delete the entire `ollama:` service block (image `ghcr.io/marrothm/burndown-ollama:latest`, volume `ollama_data:/root/.ollama`, healthcheck).
  - Delete `ollama_data:` from the top-level `volumes:` section.
  - In the `api` service, replace `OLLAMA_URL: http://ollama:11434` with `OLLAMA_URL: ${OLLAMA_URL:-http://host.docker.internal:11434}` and add `OLLAMA_MODEL: ${OLLAMA_MODEL:-qwen2.5:7b}`.
  - Add `extra_hosts:` with the single entry `- "host.docker.internal:host-gateway"` to the `api` service (a no-op on macOS Docker Desktop/OrbStack; required on Linux Docker Engine).
  - Confirm no service lists `ollama` under `depends_on`.
- [X] T004 [P] [US1] In `docker-compose.dev.yml`, delete the `ollama:` override block (`build: context ./ollama`, `pull_policy: build`).
- [X] T005 [P] [US1] Delete `ollama/Dockerfile` and `ollama/entrypoint.sh`, then remove the empty `ollama/` directory (`git rm -r ollama`).
- [X] T006 [P] [US1] In `.github/workflows/build-and-push.yml`, delete the step named `Build and push burndown-ollama` (the `docker/build-push-action@v5` step with `context: ./ollama`, tag `ghcr.io/marrothm/burndown-ollama:latest`). Leave the postgres, api and frontend steps untouched.
- [X] T007 [US1] Run `docker compose -f docker-compose.yml -f docker-compose.dev.yml config` and confirm it parses. The output must have no `ollama` service, no `ollama_data` volume, and `api.extra_hosts` must contain `host.docker.internal=host-gateway` (or the equivalent form).

**Checkpoint**: The stack runs without a bundled AI runtime. With the model present on the host, the AI Dashboard works as before (FR-001, FR-002, FR-004, FR-009).

---

## Phase 4: User Story 2 — Clear feedback when the host instance can't be used (Priority: P2)

**Goal**: The status reports `ready`, `model_missing` or `unavailable`, using an exact model and tag match. The UI enables AI only on `ready` and shows hints aimed at the host instance.

**Independent Test**:
- `npm test` passes the new status tests.
- On macmini, quitting Ollama shows `unavailable`.
- With only `qwen3-vl:8b` present, the status is `model_missing` with the hint `ollama pull qwen2.5:7b`.
- After the model is restored, the toggle is enabled again within 15 s, without a restart (quickstart §4).

### Tests for User Story 2 (write first; they must fail before T010)

- [X] T008 [P] [US2] Create `api/tests/ai-dashboard.test.js` (Vitest).
  - In each test, call `vi.resetModules()`, set `process.env.OLLAMA_MODEL`, stub `global.fetch` with `vi.fn()`, then dynamically `await import('../src/services/ai-dashboard.js')` and call `checkOllamaStatus()`.
  - Restore `fetch` and the env in `afterEach`.
  - Cases:
    - (a) tags `{models:[{name:'qwen2.5:7b',model:'qwen2.5:7b'}]}` → `'ready'`
    - (b) only `qwen3-vl:8b` → `'model_missing'`
    - (c) only `qwen2.5:14b` → `'model_missing'` (the exact tag is required; the family prefix isn't enough)
    - (d) `OLLAMA_MODEL='llama3'` with `llama3:latest` present → `'ready'`
    - (e) `fetch` resolves `{ok:false,status:500}` → `'unavailable'`
    - (f) `fetch` rejects → `'unavailable'`
  - Also assert that `fetch` was called with a URL starting `http://host.docker.internal:11434/api/tags` when `OLLAMA_URL` is unset.
- [X] T009 [P] [US2] In `api/tests/routes.test.js`, add a `describe('GET /api/ai-dashboard/status')` block.
  - Use `vi.mock('../src/services/ai-dashboard.js', () => ({ checkOllamaStatus: vi.fn(), isCached: vi.fn(() => false), generateOrCachedLayout: vi.fn(), getThresholds: vi.fn(), debugInfo: vi.fn(), updateDeclaration: vi.fn() }))`.
  - Import `aiDashboardRoutes` from `../src/routes/ai-dashboard.js` and register it in `buildApp()` with `{ prefix: '/api' }`, next to `projectRoutes`.
  - Assert:
    - when `checkOllamaStatus` resolves `'model_missing'`, the response is 200 with body `{ ollama: 'model_missing', model: 'qwen2.5:7b', cached: false }`
    - when it resolves `'unavailable'`, `ollama` is `'unavailable'`.

### Implementation for User Story 2

- [X] T010 [US2] Rewrite `checkOllamaStatus()` in `api/src/services/ai-dashboard.js` (contract: `contracts/ai-dashboard-status.md`).
  - Add `const normModel = n => (n && !n.includes(':') ? \`${n}:latest\` : n);`.
  - Compute `want = normModel(model)` and set `present = models.some(m => normModel(m.name) === want || normModel(m.model) === want)`.
  - Return `present ? 'ready' : 'model_missing'`.
  - Keep the 3 s timeout and the `'unavailable'` result for non-OK responses and exceptions.
  - Update the inline comment: the stack no longer pulls models.
- [X] T011 [US2] In `streamFromOllama()` in `api/src/services/ai-dashboard.js`, change the non-OK mapping to `e.code = (res.status === 503 || res.status === 404) ? 'AI_UNAVAILABLE' : 'AI_ERROR';`. A 404 is Ollama's "model not found". Also update the error message to `Ollama returned ${res.status} (${ollamaBaseUrl})`.
- [X] T012 [US2] Run `cd api && npm test`. T008 and T009 must now pass, and all existing tests must stay green.
- [X] T013 [P] [US2] In `frontend/src/App.jsx`:
  - Change the `DashboardToggle` prop to `aiAvailable={aiStatus.ollama === 'ready'}` (drop `'pulling'`).
  - Pass `aiStatus={aiStatus.ollama}` to `DashboardToggle`.
  - Pass `ollamaStatus={aiStatus.ollama}` and `model={aiStatus.model}` to `<AIDashboard …>`.
- [X] T014 [P] [US2] In `frontend/src/components/DashboardToggle.jsx`:
  - Accept a new `aiStatus` prop.
  - Set the `title` when not available: `'AI model not installed on host Ollama'` if `aiStatus === 'model_missing'`, otherwise `'Host Ollama unreachable'`.
  - Change the small label from `AI offline` to `AI model missing` / `AI offline` by status.
  - Keep the existing styling (design tokens only).
- [X] T015 [US2] In `frontend/src/components/ai/AIDashboard.jsx`:
  - Accept a `model` prop (default `'qwen2.5:7b'`).
  - In the `status === 'unavailable'` render block, replace the obsolete `docker compose up -d ollama` hint:
    - if `ollamaStatus === 'model_missing'`: title `Model not installed on host Ollama`, hint text `Run on the Docker host:` + `<code>ollama pull {model}</code>`.
    - otherwise: title `Host Ollama unreachable`, hint `Ensure Ollama is running on the Docker host and reachable at OLLAMA_URL (default http://host.docker.internal:11434).`
  - Keep the existing auto-retry effect (it fires when `ollamaStatus` becomes `'ready'`) and the existing styles and design tokens.
- [X] T016 [US2] Run `cd frontend && npm run build` and confirm it compiles without errors.

**Checkpoint**: All three states can be told apart, both in the API and in the UI. Recovery works without a restart (FR-005, FR-006, FR-007).

---

## Phase 5: User Story 3 — Configurable address for the AI service (Priority: P3)

**Goal**: The operator can override `OLLAMA_URL` without rebuilding, and the address in use is visible.

**Independent Test**:
- Set `OLLAMA_URL=http://macmini.local:11434` in the stack env and redeploy.
- `curl -s localhost:6088/api/ai-dashboard/debug` shows `"ollamaUrl":"http://macmini.local:11434"`, and the status is `ready`.

### Tests for User Story 3

- [X] T017 [P] [US3] In `api/tests/ai-dashboard.test.js`, add a case: with `process.env.OLLAMA_URL = 'http://macmini.local:11434/'` (trailing slash) and a fresh dynamic import, `checkOllamaStatus()` calls `fetch` with exactly `http://macmini.local:11434/api/tags`.

### Implementation for User Story 3

- [X] T018 [US3] Confirm that `debugInfo()` in `api/src/services/ai-dashboard.js` returns `ollamaUrl: ollamaBaseUrl` (FR-008). It already exists. Make no change unless the field is missing, then run `cd api && npm test`.
- [X] T019 [P] [US3] Update the AI Dashboard block in `.env.example`.
  - Replace the comment `defaults work for the standard Docker Compose stack` and the `OLLAMA_URL=http://ollama:11434` line with:
    - `# AI Dashboard — uses the Ollama running on the Docker host (not bundled).`
    - `# Prerequisite on the host: ollama pull qwen2.5:7b`
    - `# OLLAMA_URL=http://host.docker.internal:11434   # default; example override: http://macmini.local:11434`
    - `# OLLAMA_MODEL=qwen2.5:7b                         # must be installed on the host; the stack never pulls models`

**Checkpoint**: The address can be overridden and is visible in diagnostics (FR-003, FR-008).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `README.md` (constitution: README currency).
  - **Intro and prerequisites**: replace the bundled-Ollama RAM and first-start pull notes. The prerequisite becomes "Ollama on the Docker host with `ollama pull qwen2.5:7b`".
  - **Env table**: `OLLAMA_URL` default `http://host.docker.internal:11434`, example override `http://macmini.local:11434`. `OLLAMA_MODEL` must be installed on the host.
  - **Architecture diagram and services table**: remove the `ollama` row; the API talks to "Host Ollama (qwen2.5:7b)".
  - **AI toggle text**: it's disabled when Ollama is unreachable or the model is missing (not "being pulled").
  - **"Sharing Ollama with Other Projects"**: replace it with "Host Ollama". Remove the invalid `http://host-gateway:11434` example and explain `host.docker.internal` plus `extra_hosts`.
  - **Upgrade cleanup**: add a subsection to remove `burndown_ollama` and the `<stack>_ollama_data` volume.
  - **CI "Images published" table**: remove the `burndown-ollama` row.
- [X] T021 [P] In `SECURITY.md`, under "Known accepted risks", add a bullet.
  - **Content**: the AI Dashboard uses the Ollama on the Docker host, which has no authentication and is reachable from the LAN (port 11434), so anyone on the network can run inference and pull or delete models. The private-network boundary is the control.
  - **Optional hardening**: bind the host Ollama to loopback only (`OLLAMA_HOST=127.0.0.1`). The stack keeps working through `host.docker.internal` on macOS, but other LAN clients lose access. (FR-011)
- [X] T022 [P] Update `specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md`.
  - Add a note at the top of the `GET /api/ai-dashboard/status` section: "Superseded by `specs/006-host-ollama-instance/contracts/ai-dashboard-status.md` (`pulling` → `model_missing`)".
  - In the 503 row, replace "Ollama container unreachable" with "Ollama unreachable or model not found (404)".
- [X] T023 Run `grep -rn "ollama:11434\|burndown-ollama\|ollama_data\|pulling\|docker compose up -d ollama" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=specs --exclude-dir=.git .` and confirm nothing is left, then fix any remaining hit.
- [X] T024 Docker-first validation on a workstation: run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` and work through the `specs/006-host-ollama-instance/quickstart.md` §3–§4 checks (ready, unavailable, model_missing, recovery ≤ 15 s), recording the results.
- [ ] T025 Write the rollout checklist into the PR description, but don't run it. It is manual and done by the operator on macmini:
  1. `ollama pull qwen2.5:7b` on macmini.
  2. Merge to `master`.
  3. Portainer **Pull and redeploy** (manual; no CI webhook).
  4. Run quickstart §3.
  5. Cleanup per quickstart §5 (`docker rm -f burndown_ollama`, `docker volume rm <stack>_ollama_data`).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → **Foundational (T002)** → US1, US2 and US3 can then proceed.
- **US1 (P1)**: depends on T002 only. This is the MVP.
- **US2 (P2)**: depends on T002. It's independent of US1's compose changes for unit tests; the end-to-end check in its Independent Test needs US1 deployed.
- **US3 (P3)**: depends on T002. T017 extends the test file created in T008, so it runs after T008.
- **Polish (T020–T025)**: after the user stories are done. T023 runs after T020–T022; T024 runs after T023; T025 comes last.

### Within Stories

- US2: T008 and T009 (tests, failing) → T010 → T011 → T012 (green) → T013, T014 [P] → T015 → T016.
- US1: T003 → T007. T004, T005 and T006 run in parallel with T003.

### Parallel Opportunities

- US1: T004, T005 and T006 together (different files).
- US2: T008 and T009 together; T013 and T014 together after T012.
- US3 and Polish: T019, T020, T021 and T022 together (different docs).

## Parallel Example: User Story 2

```text
Task: "T008 Create api/tests/ai-dashboard.test.js with checkOllamaStatus cases"
Task: "T009 Add GET /api/ai-dashboard/status tests to api/tests/routes.test.js"
# after T010–T012:
Task: "T013 Update aiAvailable / props in frontend/src/App.jsx"
Task: "T014 Per-state tooltip in frontend/src/components/DashboardToggle.jsx"
```

## Implementation Strategy

### MVP First (User Story 1)

1. T001 → T002 → T003 to T007.
2. **Stop and validate**: with `qwen2.5:7b` on the host, the AI Dashboard works and there is no bundled container.
3. This MVP leaves `pulling` semantics in place. Because nothing pulls any more, ship US2 in the same PR before merging to `master`.

### Incremental Delivery

1. US1: bundled runtime removed; host used (MVP).
2. US2: correct `model_missing` and `unavailable` feedback. **Required before the production redeploy**, because macmini currently has only `qwen3-vl:8b`.
3. US3: override documented and verified.
4. Polish: README, SECURITY, superseded contract note, grep sweep, Docker validation, rollout checklist.

## Notes

- Commit with scoped prefixes (`feat:`, `docs:`, `chore:`) and the Co-Authored-By trailer.
- Do not pull or delete models on macmini from automation. The host is shared, and changing its models is an operator step.
- Do not add CI webhooks to Portainer. Redeploys are manual.

## Validation Log (T024, 2026-11-21)

Isolated compose project (project Postgres image + `api` built from this branch, `extra_hosts` set) on an OrbStack workstation. Torn down afterwards.

| Check | Result |
|-------|--------|
| Default URL, no Ollama on the Docker host | `unavailable`; `/debug` `ollamaUrl` = `http://host.docker.internal:11434` ✅ |
| Fake Ollama on host **loopback**, only `qwen3-vl:8b` | `model_missing` ✅ (`host.docker.internal` reaches loopback) |
| `GET /api/ai-dashboard` with chat returning 404 | SSE `{"error":"AI_UNAVAILABLE","status":503}` + `[DONE]` ✅ |
| Fake stopped | `unavailable` without restart ✅ |
| Fake restarted with `qwen2.5:7b` | `ready` without restart ✅ |
| `/api/health` with AI unavailable | `{"ok":true}` ✅ |
| Override `OLLAMA_URL=http://macmini.local:11434` | `unavailable`: `.local` didn't resolve in the container (`EAI_AGAIN`), and the LAN IP timed out from the container → documented caveat ⚠️ |
| Real `qwen2.5:7b` on macmini | Not run: the model isn't installed on the host yet (operator step) |
