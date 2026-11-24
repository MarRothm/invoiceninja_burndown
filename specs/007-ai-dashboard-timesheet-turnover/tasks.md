# Tasks: Timesheet and Turnover in the AI Dashboard

**Input**: Design documents from `specs/007-ai-dashboard-timesheet-turnover/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ai-dashboard-stream-and-grammar.md, quickstart.md

**Tests**: The API has Vitest tests for SSE framing and prompt rules (plan/R7); the constitution requires `test.yml` to stay green. `frontend/` has no test runner, so frontend work is verified with `npm run build`, a parser check and a manual Docker check.

**Organization**: Tasks are grouped by user story, in this order: US4 (P1, live build-up and bug fix) → US1 (P1, Turnover) → US2 (P2, Timesheet) → US3 (P3, composition docs and default). US4 comes first because it is required to see the other stories render correctly. All paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks).
- **[Story]**: The user story the task belongs to.

---

## Phase 1: Setup

- [X] T001 Run `cd api && npm test` and `cd frontend && npm run build`. Record the baseline: 151 API tests pass and the frontend build succeeds.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 In `api/src/services/ai-dashboard.js`, change `const SYSTEM_PROMPT = \`…\`` to `export const SYSTEM_PROMPT = \`…\`` so tests can assert its rules. Don't change the content yet.
- [X] T003 In `frontend/src/components/ai/AIDashboard.jsx`, change the `onDone` empty-response guard from `/ProjectCard|BurndownChart|Dashboard/` to `/Dashboard|ProjectCard|BurndownChart|TimesheetSummary|ProjectTurnover|TurnoverOverview/`.

**Checkpoint**: The prompt is testable, and the guard accepts the new block names.

---

## Phase 3: User Story 4 — Dashboard builds up live without a manual reload (Priority: P1) 🎯 MVP

**Goal**: Every block appears as soon as it is generated, and the finished dashboard equals the cached view (FR-014, FR-015). See research R1 for the two root causes.

**Independent Test**:
1. Run `PUT /api/ai-dashboard/declaration` with the current text to force a cache miss.
2. Open the AI view without reloading: the number of blocks grows during generation, and at `[DONE]` all blocks are visible.
3. Reload the page: the view is identical.
4. The quickstart §3 reassembly script prints `root = Dashboard([...])` as its first line, followed by more than one line.

### Tests for User Story 4 (write first; they must fail before T007/T008)

- [X] T004 [P] [US4] In `api/tests/routes.test.js`, add `describe('GET /api/ai-dashboard SSE framing')`.
  - Make the mocked `generateOrCachedLayout` call its `write` argument with `'card2 = ProjectCard(2)\n'`, then `'chart2'`. Use `generateOrCachedLayout.mockImplementationOnce(async (write) => { write('card2 = ProjectCard(2)\n'); write('chart2'); })` after importing it from `../src/services/ai-dashboard.js`.
  - Call `app.inject({ method: 'GET', url: '/api/ai-dashboard' })` and assert that `res.body` contains `'data: card2 = ProjectCard(2)\ndata: \n\n'`, `'data: chart2\n\n'` and ends with `'data: [DONE]\n\n'`.
  - Add a helper that reassembles events with EventSource rules. Split on `\n\n`; for each event, join its `data:` lines with `\n` after stripping `data:` plus one optional space. The concatenation of the non-`[DONE]` events must equal `'card2 = ProjectCard(2)\nchart2'`.
- [X] T005 [P] [US4] In `api/tests/ai-dashboard.test.js`, add `describe('SYSTEM_PROMPT')`. Import `SYSTEM_PROMPT` via `loadService()` and assert:
  - (a) it contains `FIRST statement MUST be` and `root = Dashboard(`;
  - (b) it no longer contains `The LAST statement MUST be`;
  - (c) in its `Example` section, the first non-empty line after the line `Example` starts with `root = Dashboard(`.

### Implementation for User Story 4

- [X] T006 [US4] Run `cd api && npm test` and confirm that T004 and T005 fail for the expected reasons (old framing, old prompt).
- [X] T007 [US4] In `api/src/routes/ai-dashboard.js`, replace `const write = (data) => raw.write(\`data: ${data}\n\n\`);` with:

  ```js
  const write = (data) => raw.write(String(data).split('\n').map(l => `data: ${l}`).join('\n') + '\n\n');
  ```

  Add the comment "SSE multi-line data: EventSource rejoins lines with \n, so tokens arrive byte-identical (contract 007 §1)".
- [X] T008 [US4] In `SYSTEM_PROMPT` in `api/src/services/ai-dashboard.js`:
  - Replace rule 1 with: `1. The FIRST statement MUST be:  root = Dashboard([...all component names in display order...]) — then define each component on its own line, in the same order.`
  - Rewrite rule 3 to: `3. Every component you define MUST be listed in Dashboard's children array.`
  - Replace the example block with a root-first example:
    `root = Dashboard([card1, chart1, card3, chart3])`, then `card1 = ProjectCard(1)`, `chart1 = BurndownChart(1)`, `card3 = ProjectCard(3)`, `chart3 = BurndownChart(3)`.
  - Leave the component list unchanged in this task.
- [X] T009 [US4] Run `cd api && npm test`. All tests must be green, including T004 and T005.
- [X] T010 [US4] Verify against the host Ollama without a browser. With the branch API running locally (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build api postgres redis`, with `OLLAMA_URL` pointing at a reachable host Ollama that has `qwen2.5:7b`):
  - run `curl -sN localhost:<api-port>/api/ai-dashboard > /tmp/aistream.txt`;
  - run the quickstart §3 reassembly one-liner;
  - expect line 1 `root = Dashboard([...])` and one line per component.

  If no Ollama is reachable from the workstation, record that and do the check in T031 on macmini.

**Checkpoint**: Today's cards and charts build up live and finish without a reload (SC-006).

---

## Phase 4: User Story 1 — Turnover on the AI Dashboard (Priority: P1)

**Goal**: The `ProjectTurnover(projectId)` and `TurnoverOverview(year?)` blocks show the same amounts as the existing views (FR-001, FR-002, FR-005, FR-007, FR-008).

**Independent Test**:
- Set the declaration to: "Show the turnover overview for the current year first, then for each in_progress project a ProjectCard and its project turnover".
- The totals in the overview equal the Turnover view for the current year.
- Each project's turnover table equals the project detail turnover.
- A project with no invoices shows "No invoices yet".

### Implementation for User Story 1

- [X] T011 [P] [US1] Create `frontend/src/components/ai/ProjectTurnover.ai.jsx`:
  - `export default function ProjectTurnoverAI({ props: { projectId } })` renders `<ProjectTurnover projectId={projectId} reloadKey={0} />` (import the default from `../ProjectTurnover.jsx`).
  - Wrap it in `<div style={{ marginBottom: 16 }}>`.
  - `ProjectTurnover` already handles loading, error with retry, and the "No invoices yet" state.
- [X] T012 [P] [US1] Create `frontend/src/components/ai/TurnoverOverview.ai.jsx`:
  - `export default function TurnoverOverviewAI({ props: { year } })`.
  - **Year**: compute `const y = Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : new Date().getFullYear();`.
  - **Data**: fetch with `fetchTurnover(y)` from `../../hooks/api.js` in a `useEffect` with a cancelled flag, using states `loading`, `ready` and `error`.
  - **Layout**: reuse `cardStyle`, `retryButton`, `TurnoverHead`, `AmountCells`, `totalRowStyle` and `TurnoverFooter` exported from `../ProjectTurnover.jsx`. Render the header `TURNOVER {y}` (style like `ProjectTurnover`'s `TURNOVER` label), one table row per `data.projects` entry (name in the first cell, then `<AmountCells row={p} />`), a Total row with `<AmountCells row={data.total} bold />`, and `<TurnoverFooter lastSyncedAt={data.last_synced_at} />`.
  - **Empty and error states**: `data.projects.length === 0` shows `No invoices in {y}`. An error shows the message plus a Retry button. Use design tokens only (`var(--…)`).
- [X] T013 [US1] In `frontend/src/components/ai/components.js`, import the two new components and register them:
  - `ProjectTurnover`: description `'Turnover per year (invoiced, paid, open) for one project.'`, props `z.object({ projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID') })`.
  - `TurnoverOverview`: description `'Cross-project turnover (invoiced, paid, open) for one year; omit year for the current year.'`, props `z.object({ year: z.coerce.number().int().optional().describe('Calendar year, e.g. 2026; omit for current year') })`.
  - Add both to the `components` array of `createLibrary`.
- [X] T014 [US1] In `SYSTEM_PROMPT` in `api/src/services/ai-dashboard.js`:
  - Add to "Available components":
    - `- ProjectTurnover(projectId) — invoiced/paid/open per year for one project`
    - `- TurnoverOverview(year) — cross-project turnover for one year; year is optional`
  - Add the rules:
    - `7. Use ProjectTurnover only if the declaration asks for turnover per project; use TurnoverOverview only if it asks for a turnover overview. Never add them otherwise.`
    - `8. Pass a year only if the declaration names a specific year; otherwise write TurnoverOverview() with no argument.`
- [X] T015 [US1] In `api/tests/ai-dashboard.test.js`, extend the `SYSTEM_PROMPT` tests: assert that it contains `ProjectTurnover(projectId)`, `TurnoverOverview(year)` and `TurnoverOverview()`. Run `cd api && npm test`.
- [X] T016 [US1] Run `cd frontend && npm run build` and confirm it succeeds.

**Checkpoint**: Turnover blocks render when declared and are absent otherwise.

---

## Phase 5: User Story 2 — Timesheet on the AI Dashboard (Priority: P2)

**Goal**: `TimesheetSummary(projectId, month?)` shows the month total in hours, the rate and EUR, and opens the full timesheet (FR-003, FR-004, FR-005, FR-007).

**Independent Test**:
- Declare "…and the timesheet summary of the current month" per project.
- Hours, rate and EUR equal the timesheet modal for that month.
- A click (or Enter) opens the modal on that month.
- A month without bookings shows `0.00 h`; a project without a rate shows `—`.

### Implementation for User Story 2

- [X] T017 [P] [US2] In `frontend/src/components/TimesheetModal.jsx`, change the signature to `TimesheetModal({ project, onClose, initialMonth })` and initialise `const [month, setMonth] = useState(() => initialMonth ?? currentMonth());`. Existing callers that don't pass `initialMonth` keep today's behaviour.
- [X] T018 [P] [US2] Create `frontend/src/components/ai/TimesheetSummary.ai.jsx`:
  - `export default function TimesheetSummaryAI({ props: { projectId, month } })`.
  - **Month**: compute `const m = /^\d{4}-(0[1-9]|1[0-2])$/.test(month ?? '') ? month : currentMonth();` (import `currentMonth`, `formatHours`, `formatEUR` and `formatRate` from `../../utils/timesheet.js`).
  - **Data**: read `{ projects, onOpenTimesheet }` from `AIDashboardContext` and find the project by `String(p.id) === String(projectId)`. Fetch `fetchTimesheet(projectId, m)` from `../../hooks/api.js` with a cancelled flag.
  - **Layout**: render a card (`background: 'var(--card)'`, `border: '1px solid var(--border)'`, `borderRadius: 4`, `padding: '10px 16px'`, `marginBottom: 16`) with:
    - the label `TIMESHEET {m}` (fontSize 11, `var(--muted)`);
    - the hours `{formatHours(data.total)} h` (fontWeight 700, `var(--accent)`);
    - `data.rate === null ? 'No hour rate set' : formatRate(data.rate)`;
    - `formatEUR(data.amount)`.
  - **Opening the full timesheet**: the card has `role="button"`, `tabIndex={0}` and `title="Open full timesheet"`. `onClick` and `onKeyDown` (Enter or Space) call `onOpenTimesheet?.(project ?? data.project, m)`.
  - **States**: loading shows `Loading timesheet…`. An error shows a short notice in the card; for 404, the text is `Project not found`.
- [X] T019 [US2] In `frontend/src/components/ai/AIDashboard.jsx`:
  - Accept a new prop `onOpenTimesheet`.
  - Add it to `contextValue` (`{ projects, theme, thresholds, onOpenTimesheet }`).
  - In `frontend/src/components/ai/AIDashboardContext.jsx`, add `onOpenTimesheet: undefined` to the default context.
- [X] T020 [US2] In `frontend/src/App.jsx`:
  - Add the state `const [timesheetMonth, setTimesheetMonth] = useState(null);`.
  - Pass `onOpenTimesheet={(p, m) => { setTimesheetMonth(m); setTimesheetProject(p); }}` to `<AIDashboard …>`.
  - Render `<TimesheetModal project={timesheetProject} onClose={closeTimesheet} initialMonth={timesheetMonth ?? undefined} />`.
  - Make `closeTimesheet` also call `setTimesheetMonth(null)`.
  - The existing legacy openers keep working without a month. Check that `TimesheetModal` remounts when a new project is opened; if it stays mounted, add `key={`${timesheetProject?.id}-${timesheetMonth}`}`.
- [X] T021 [US2] In `frontend/src/components/ai/components.js`, register `TimesheetSummary`:
  - description: `'Month total of booked hours with hour rate and EUR for one project; omit month for the current month.'`
  - props: `z.object({ projectId: z.coerce.number().int().positive().describe('InvoiceNinja project ID'), month: z.string().optional().describe('Month YYYY-MM; omit for current month') })`
  - Add it to `components`.
- [X] T022 [US2] In `SYSTEM_PROMPT` in `api/src/services/ai-dashboard.js`:
  - Add the component line `- TimesheetSummary(projectId, month) — month total of booked hours + EUR for one project; month "YYYY-MM" is optional`.
  - Add the rule `9. Use TimesheetSummary only if the declaration asks for the timesheet. Pass a month only if the declaration names a specific month; otherwise write TimesheetSummary(projectId) with one argument.`
  - Extend the `SYSTEM_PROMPT` test in `api/tests/ai-dashboard.test.js` to assert `TimesheetSummary(projectId, month)`.
  - Run `cd api && npm test`.
- [X] T023 [US2] Run `cd frontend && npm run build` and confirm it succeeds.

**Checkpoint**: The timesheet summary renders and opens the full timesheet on the right month.

---

## Phase 6: User Story 3 — Understand and edit the dashboard composition (Priority: P3)

**Goal**:
- The default declaration shows the new blocks out of the box: a Turnover Overview, plus a Timesheet Summary per project, and no Project Turnover (FR-009).
- The documentation lists every block (FR-013).

**Independent Test**:
- A fresh stack with the default declaration shows one Turnover Overview at the top, then card, burndown and timesheet summary per in_progress project, and no ProjectTurnover.
- Following only the README, a declaration that uses all blocks renders each of them (SC-004).

### Implementation for User Story 3

- [X] T024 [US3] Replace the contents of `api/dashboard.declaration.md` with:

  ```text
  Show the turnover overview for the current year at the top.

  Then show all in_progress projects ordered by budget consumed (highest progress percentage first).
  Include every project with status "in_progress", even those with 0 hours logged.

  For each project show a ProjectCard (which includes a built-in status badge and progress bar),
  followed by its BurndownChart and the timesheet summary of the current month.
  ```

- [X] T025 [US3] In `api/src/services/ai-dashboard.js`, update `DEFAULT_DECLARATION` (the fallback used when no file exists) to the same text as T024.
- [X] T026 [US3] In `api/tests/ai-dashboard.test.js`, add a test that reads `api/dashboard.declaration.md` (`readFile(new URL('../dashboard.declaration.md', import.meta.url))`). Assert that it mentions `turnover overview` and `timesheet`, and does not contain `project turnover` (case-insensitive). Run `cd api && npm test`.
- [X] T027 [US3] In the `## AI Dashboard` section of `README.md`, add a subsection `### Dashboard composition (declaration)`:
  - The composition is defined in plain language in `api/dashboard.declaration.md`.
  - Runtime override: `PUT /api/ai-dashboard/declaration` with a `{"content": "..."}` example. It is stored in `/app/data/dashboard.declaration.md`, takes priority over the baked-in file, and clears the layout cache.
  - Extend the existing component table with `TimesheetSummary(projectId, month?)`, `ProjectTurnover(projectId)` and `TurnoverOverview(year?)`.
  - Add one example sentence per block (from quickstart §1).
  - Explain that omitting the month or year means current, resolved at display time.
  - State that blocks appear only when the declaration asks for them.
  - Note that the dashboard builds up live during generation.

**Checkpoint**: Out-of-the-box dashboard and documentation are complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T028 [P] In `specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md`, add a note under the `## GET /api/ai-dashboard` heading and under `## openUI Lang Component Grammar`: "Amended by `specs/007-ai-dashboard-timesheet-turnover/contracts/ai-dashboard-stream-and-grammar.md` (multi-line SSE data framing; root statement first; new components)".
- [X] T029 Run `grep -rn "LAST statement\|ProjectCard|BurndownChart|Dashboard/" api/src frontend/src`. There must be no hits that contradict the new rules. Run `cd api && npm test` and `cd frontend && npm run build` as the final green check.
- [X] T030 Docker-first validation on a workstation: run `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` and work through quickstart §3–§5:
  - live build-up;
  - reload is identical;
  - numbers equal the existing views for two projects;
  - the old declaration yields the old dashboard (SC-005);
  - month and year overrides;
  - empty and no-rate states;
  - clicking the timesheet summary opens the modal on the right month.

  Record the results in a `## Validation Log` section at the end of this file. If no host Ollama with `qwen2.5:7b` is reachable from the workstation, record which checks moved to T031.
- [ ] T031 Write a post-deploy checklist for macmini in the PR description; it is manual and not executed here:
  1. Merge to `master` and wait until CI has built the images.
  2. Run **Pull and redeploy** in Portainer.
  3. Run a `PUT` on the declaration, or rely on the restart, to get a fresh generation.
  4. Watch the live build-up without reloading.
  5. Time a cache-miss generation: `time curl -sN http://macmini.local:6088/api/ai-dashboard >/dev/null` must stay below 30 s (SC-003).
  6. Spot-check the numbers for two projects (SC-001).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002–T003)** → **US4 (T004–T010)**.
- After US4: US1 (T011–T016), US2 (T017–T023) and US3 (T024–T027).
- **Shared files**: US1, US2 and US3 all edit `SYSTEM_PROMPT` (T014, T022) and `components.js` (T013, T021). Run those tasks in story order (T013 → T021, T014 → T022) to avoid conflicts. Their other tasks are independent.
- **Polish**: T028 can run anytime. T029 runs after all stories, then T030, then T031.

### Within Stories

- **US4**: T004 and T005 (tests) → T006 (confirm they fail) → T007 → T008 → T009 → T010.
- **US1**: T011 and T012 in parallel → T013 → T014 → T015 → T016.
- **US2**: T017 and T018 in parallel → T019 → T020 → T021 → T022 → T023.
- **US3**: T024 → T025 → T026 → T027.

### Parallel Example

```text
# US4 tests
Task: "T004 SSE framing test in api/tests/routes.test.js"
Task: "T005 SYSTEM_PROMPT root-first test in api/tests/ai-dashboard.test.js"
# US1 components
Task: "T011 ProjectTurnover.ai.jsx"
Task: "T012 TurnoverOverview.ai.jsx"
# US2
Task: "T017 TimesheetModal initialMonth"
Task: "T018 TimesheetSummary.ai.jsx"
```

## Implementation Strategy

### MVP

1. T001–T010 (US4). This fixes the bug the user reported for today's dashboard and can ship on its own.

### Incremental Delivery

1. US4: live build-up and reload-free completion.
2. US1: turnover blocks (P1).
3. US2: timesheet summary (P2).
4. US3: new default declaration and README composition docs. Until this ships, the new blocks appear only if the operator declares them.
5. Polish and validation, then the macmini rollout (T031).

## Notes

- **Commits**: use scoped commits (`fix:` for US4, `feat:` for US1/US2, `docs:` for US3/README) with the Co-Authored-By trailer.
- **Tests**: never change `api/tests` expectations to make a failing implementation pass. Fix the implementation instead.
- **Portainer**: redeploys are manual. No CI webhooks.

## Validation Log (T010, T030, 2026-11-24)

**Real model** (`qwen2.5:7b` on the host Ollama at macmini, 4 in_progress production projects): new `SYSTEM_PROMPT`, new SSE framing, browser-style EventSource reassembly, and `@openuidev/lang-core` parse at 25/50/75/100 % of the stream.

| Declaration | Time | First line | Blocks during stream | Result |
|-------------|------|------------|----------------------|--------|
| New default | 6.3 s | `root = Dashboard([...])` | 0 → 3 → 8 → 13 | 1 × TurnoverOverview(), then card, chart and TimesheetSummary(n) per project; no ProjectTurnover ✅ |
| Old declaration (cards and charts) | 3.7 s | root first | 0 → 2 → 5 → 8 | Same blocks as before this feature (SC-005) ✅ |
| Custom: "overview for 2025", "project turnover", "timesheet for October 2026" | 7.9 s | root first | 0 → 4 → 8 → 13 | `TurnoverOverview(2025)`, `ProjectTurnover(n)`, `TimesheetSummary(n, "2026-10")` ✅ |

For comparison, before this change: the production stream parsed in the browser gave 1 block only (newlines lost, root last).

**Through the API container** (isolated compose with the branch's api image and the project's Postgres image; a replay Ollama on host loopback streams the default layout in 7-char chunks with bare `\n` tokens):
- The streamed tokens reassembled with EventSource rules are byte-identical to the model output.
- The 2nd request is served from the cache, with `cached layout == streamed layout`.
- The status is `ready` through `host.docker.internal`.

**Tests and build**: 156/156 API tests pass; `frontend` builds.

**Not verified here** (moved to T031 on macmini after the redeploy):
- in-browser rendering of the new blocks (visual check);
- numbers compared with the existing views in the UI;
- clicking the TimesheetSummary to open the modal on the right month;
- the no-rate, empty-month and year-without-invoices states in the UI.

The workstation container can't reach the macmini Ollama, and there is no browser automation available in this session.
