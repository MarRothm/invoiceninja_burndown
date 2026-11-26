---

description: "Task list for feature 009: AI Dashboard as the only dashboard"
---

# Tasks: AI Dashboard as the Only Dashboard

**Input**: Design documents from `specs/009-ai-dashboard-only/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: The spec does not ask for new tests. The frontend has no test runner (YAGNI). Validation:
- `npm run build` in `frontend/`;
- the API Vitest suite stays green and unchanged (198 tests);
- the browser checks in `quickstart.md`.

**Organization**: Grouped by user story. Nearly all source changes are in `frontend/src/App.jsx`, so most tasks run in order. Only work on other files is marked [P].

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different file, no dependency on an incomplete task)
- **[Story]**: US1, US2 or US3 from spec.md

---

## Phase 1: Setup

**Purpose**: Confirm the baseline before code is removed.

- [X] T001 Run `npm test` in `api/` and `npm run build` in `frontend/`. Record the test count (expected 198, all green) in `specs/009-ai-dashboard-only/tasks.md` under "Notes" as the baseline for FR-009 / SC-005.

---

## Phase 2: Foundational

**Purpose**: none. No shared prerequisites. The user stories build on the existing AI Dashboard (features 002, 007 and 008).

---

## Phase 3: User Story 1 - The app opens directly on the AI Dashboard (Priority: P1) 🎯 MVP

**Goal**: The AI Dashboard is the only dashboard. There is no toggle and no classic view, and a stale stored preference is ignored and cleared.

**Independent Test**:
1. Run `localStorage.setItem('burndown_dashboard_mode','legacy')` in devtools, then reload.
2. The AI Dashboard is shown, and `localStorage.getItem('burndown_dashboard_mode')` is `null`.
3. No toggle is visible.
4. Sync now refreshes the AI Dashboard.

### Implementation for User Story 1

- [X] T002 [US1] In `frontend/src/App.jsx`, remove the dashboard mode:
  - delete the `DashboardToggle` import;
  - delete the `dashMode` state (localStorage `burndown_dashboard_mode`, default `'legacy'`) and `handleToggle`, including its `localStorage.setItem`;
  - delete the `<DashboardToggle … />` element in the sidebar.
- [X] T003 [US1] In `frontend/src/App.jsx`, add a one-off `useEffect(() => { localStorage.removeItem('burndown_dashboard_mode'); }, [])` (FR-003, research R3).
- [X] T004 [US1] In `frontend/src/App.jsx`, render the main area as follows:
  - when `view === 'turnover'`: `<TurnoverOverview …/>`;
  - otherwise: `<AIDashboard …/>`, with no `dashMode === 'ai'` condition;
  - remove the whole legacy branch (selected-project header, stats, burndown chart, legend, Timesheet button, `ProjectTurnover`, empty and loading placeholders).
- [X] T005 [US1] In `frontend/src/App.jsx`, move the dismissible sync-error banner out of the removed legacy branch, so it renders at the top of the main area in every view (research R4).
- [X] T006 [US1] In `frontend/src/App.jsx`:
  - simplify `handleSync` to `await triggerSync()`, then bump `aiReloadKey` and `turnoverKey` (no `loadProjects`);
  - keep the syncing flag and the error handling unchanged.
- [X] T007 [P] [US1] Delete `frontend/src/components/DashboardToggle.jsx`. First confirm with `grep -rn DashboardToggle frontend/src` that nothing else imports it.
- [X] T008 [P] [US1] In `api/src/routes/ai-dashboard.js` line 4, change the comment "AI service health check for toggle enablement" to "AI service health check (AI availability)". Comment only; no code change.

**Checkpoint**: `npm run build` succeeds. Quickstart checks 1 and 5 pass.

---

## Phase 4: User Story 2 - Behaviour when the AI is unavailable (Priority: P1)

**Goal**: When the AI is unavailable, the main area shows the reason within about 3 s (with no substitute layout) and recovers automatically.

**Independent Test**:
1. On a test stack, use `OLLAMA_MODEL=does-not-exist:1b`, or stop Ollama.
2. "Model not installed on host Ollama" or "Host Ollama unreachable" appears within about 3 s.
3. € Turnover and Sync now still work.
4. After restoring, the dashboard appears within about 15 s without a reload.

### Implementation for User Story 2

- [X] T009 [US2] In `frontend/src/App.jsx`:
  - change the initial `aiStatus` to `{ ollama: 'checking', cached: false }`, so the dashboard does not judge availability before the first status check;
  - pass `cached={aiStatus.cached}` to `<AIDashboard>`, next to the existing `ollamaStatus` prop.
- [X] T010 [US2] In `frontend/src/components/ai/AIDashboard.jsx`:
  - accept the new prop `cached`;
  - add an effect on `[ollamaStatus, cached]` with this condition: `statusRef.current === 'loading'` and `ollamaStatus` is `'unavailable'` or `'model_missing'` and `!cached`;
  - when the condition holds:
    - call `closeRef.current?.()`;
    - clear both pending timers, setting the refs to null;
    - set the status to `'unavailable'`, keeping the reason from `ollamaStatus` for the existing message.
  - Make sure `'checking'` is treated as "not yet known" and never triggers the unavailable state.
  - Leave the existing auto-retry effect on `ollamaStatus === 'ready'` unchanged; it handles recovery.
- [X] T011 [US2] In `frontend/src/components/ai/AIDashboard.jsx`, check the unavailable state:
  - it shows only the reason ("Host Ollama unreachable" / "Model not installed on host Ollama") plus the hint that the dashboard appears automatically once the AI is available;
  - it shows no layout and no stale classic content;
  - if the hint text is missing, add it (spec US2 scenario 1).

**Checkpoint**: Quickstart check 6 passes on a test stack (do not pull or delete models on the shared macmini host).

---

## Phase 5: User Story 3 - Navigation without the classic project list and detail (Priority: P2)

**Goal**: The sidebar holds only the title, Sync now, € Turnover and the theme selector. The timesheet opens from TimesheetSummary blocks. A turnover row click shows the AI Dashboard.

**Independent Test**:
1. The sidebar has no project cards.
2. A click on a TimesheetSummary block opens the full timesheet for that project and month, and copy / CSV work.
3. A click on a project row in € Turnover shows the AI Dashboard.
4. Clicking € Turnover again also returns to the AI Dashboard.

### Implementation for User Story 3

- [X] T012 [US3] In `frontend/src/App.jsx`, remove the sidebar project list:
  - delete the `ProjectCard` import and the project card list (including its ▦ timesheet icon handler);
  - delete the `projects`, `selected`, `loading`, `burndown` and `chartLoad` state;
  - delete `loadProjects` and its mount effect, the burndown fetch effect, and the `current` / `isLumpSum` / `selectedLumpSum` derivations;
  - delete the `Stat` helper;
  - delete the now-unused imports: `BurndownChart`, `ProjectTurnover`, `fetchProjects`, `fetchBurndown`, `formatMoney`.
  - The final sidebar order is: title, Sync now, € Turnover, spacer, ThemeSelector (`contracts/ui.md`).
- [X] T013 [US3] In `frontend/src/App.jsx`, change `openProjectFromTurnover` to `() => setView('dashboard')` (research R5), and keep passing it to `<TurnoverOverview>`.
- [X] T014 [US3] In `frontend/src/App.jsx`, keep `timesheetProject` / `timesheetMonth`, `TimesheetModal` and the `onOpenTimesheet` callback passed to `<AIDashboard>`, so the TimesheetSummary blocks still open the full timesheet (FR-006). Remove only callers that belonged to the deleted sidebar cards or the legacy header.
- [X] T015 [P] [US3] Delete `frontend/src/components/ProjectCard.jsx`, the classic card (the AI card is `frontend/src/components/ai/ProjectCard.ai.jsx`). First confirm with `grep -rn "components/ProjectCard.jsx\|from './ProjectCard" frontend/src` that nothing else imports it.
- [X] T016 [US3] Check that `frontend/src/components/BurndownChart.jsx` and `frontend/src/components/ProjectTurnover.jsx` are still imported by AI blocks (`frontend/src/components/ai/*.ai.jsx`). Keep them; do not delete shared building blocks (research R1). Lump-sum projects must lose nothing: leave `frontend/src/components/ai/ProjectCard.ai.jsx` (`LumpSumCard`), the ProjectTurnover AI block and prompt rule 10 in `api/src/services/ai-dashboard.js` untouched. Delete only the lump-sum code in `frontend/src/App.jsx` (`isLumpSum`, `selectedLumpSum`, the Agreed / Invoiced / Earned stats). See spec US3 scenario 5.

**Checkpoint**: `npm run build` succeeds, with no unused-import warnings from removed code. Quickstart checks 2, 3 and 4 pass.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 [P] Update the `README.md` Timesheet section (around line 116): open the timesheet by clicking a **timesheet summary block** on the AI Dashboard. Remove the "▦ icon on any project card in the sidebar (legacy and AI mode)" and "▦ Timesheet button in the project header" wording.
- [X] T018 [P] Update the `README.md` Turnover section (around lines 139–144):
  - remove the "project detail view (legacy mode) has a Turnover table" bullet;
  - describe the AI project-turnover block instead, if it is not already covered;
  - change "€ Turnover in the sidebar (legacy and AI mode)" to "€ Turnover in the sidebar";
  - change "Click a project to open its detail view" to "Click a project to return to the AI Dashboard".
- [X] T019 [P] Update the `README.md` lump-sum table (around lines 171–172):
  - remove the "Project detail" row;
  - fold the "Project card" row into the AI Dashboard row (lump-sum card with `LUMP SUM` badge, agreed lump sum and earned %, then the project turnover instead of burndown / timesheet);
  - keep the Turnover overview row.
- [X] T020 [P] In `README.md`, replace "### Switching Views" (around lines 198–203) with "### Dashboard". It should say:
  - the AI Dashboard is the only dashboard; there is no toggle;
  - when the host Ollama is unreachable or the model is missing, the main area shows the reason (with the `ollama pull <model>` hint for a missing model) and the dashboard appears automatically once the AI is available;
  - € Turnover and Sync now keep working meanwhile.
- [X] T021 Run `grep -rn "legacy\|DashboardToggle\|burndown_dashboard_mode\|Switching Views" README.md frontend/src api/src` and remove any remaining references to the classic dashboard (FR-008). Matches unrelated to the dashboard are fine.
- [X] T022 Run `npm run build` in `frontend/` and `npm test` in `api/`. The test count must equal the T001 baseline, all green.
- [ ] T023 Run the Docker-first checks from `specs/009-ai-dashboard-only/quickstart.md` (checks 1–5, 7 and 8 locally; check 6 on a test stack). Record the results under "Notes" in this file. The operator verifies on macmini after a manual Portainer redeploy.

---

## Dependencies & Execution Order

- **Setup (T001)**: first, as the baseline.
- **US1 (T002–T008)**: the MVP. T002 → T003 → T004 → T005 → T006 run in order (same file). T007 and T008 can run alongside them.
- **US2 (T009–T011)**: after T004, since `<AIDashboard>` must be rendered unconditionally. T009 (App.jsx) and T010–T011 (AIDashboard.jsx) touch different files, but T010 relies on the `cached` prop from T009.
- **US3 (T012–T016)**: after T004, because the legacy branch must be gone before its state can be removed. T012 → T013 → T014 run in order (App.jsx). T015 and T016 can run alongside them after T012.
- **Polish (T017–T023)**: T017–T020 (README) can run alongside any story. T021–T023 run last.

### Parallel Opportunities

- During US1: T007 (delete DashboardToggle.jsx) and T008 (API comment), alongside App.jsx edits.
- During US2 and US3: T010 (AIDashboard.jsx) alongside T012–T014 (App.jsx), once T009 is done.
- During any phase: T017–T020 (README sections).

### Parallel Example

```text
Task: "T007 Delete frontend/src/components/DashboardToggle.jsx"
Task: "T008 Comment fix in api/src/routes/ai-dashboard.js"
Task: "T020 Replace 'Switching Views' in README.md"
```

---

## Implementation Strategy

### MVP (User Story 1)

1. T001 baseline, then T002–T008.
2. At this point the app opens only on the AI Dashboard, with no toggle, and sync errors are visible.

### Incremental Delivery

1. US1, the single dashboard: deployable on its own.
2. US2, the fast unavailable message (about 3 s) and recovery.
3. US3, the slim sidebar and the turnover click. This removes the remaining dead code.
4. Polish: README, the leftover grep, the build and test run, and the quickstart checks.

US1 and US3 both edit `App.jsx`. Doing them in one sitting, in task order, is the simplest path.

---

## Notes

- Baseline (T001): API 198 tests passed (7 files); frontend `npm run build` OK.
- After implementation (T022): API 198 tests passed (unchanged); frontend build OK; frontend Docker image builds.
- Leftover grep (T021): no classic-dashboard references remain. Remaining matches are unrelated (timesheet `FormatToggle`, `.sidebar` CSS, the one-off `removeItem` for the old key).
- Quickstart (T023): _open_. Browser checks 1–8 are for the operator (local stack or macmini after a manual Portainer redeploy). Check 6 runs on a test stack only; do not pull or delete models on the shared host.
