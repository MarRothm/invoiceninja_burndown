---

description: "Task list for feature 010: full-width dashboard with menu, closed projects and lump-sum marking"
---

# Tasks: Full-Width Dashboard with Menu, Closed Projects and Lump-Sum Marking

**Input**: Design documents from `specs/010-header-menu-closed-projects/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, contracts/ui.md, quickstart.md

**Tests**: The spec asks for none. The plan adds API Vitest tests for the one API change (`billing_mode` in `/api/turnover`; research R3), because the existing 008 test is affected. The frontend has no test runner (YAGNI). It is checked with `npm run build` and the browser checks in `quickstart.md`.

**Organization**: grouped by user story (US1 to US4 from spec.md). Work in the same file runs in order. [P] marks work in a different file with no open dependency.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Run `npm test` in `api/` and `npm run build` in `frontend/`. Record the test count (expected 198, all green) under "Notes" in `specs/010-header-menu-closed-projects/tasks.md` as the baseline.

---

## Phase 2: Foundational

- [X] T002 Create `frontend/src/components/Badge.jsx`. It exports `Badge({ children })`: a small uppercase label using the same style as the current `LUMP SUM` span in `LumpSumCard` (`frontend/src/components/ai/ProjectCard.ai.jsx`): fontSize 10, fontWeight 600, letterSpacing 0.05em, padding 2px 8px, borderRadius 3, background `var(--border)`, color `var(--muted)`, `whiteSpace: 'nowrap'`. Design tokens only. US3 and US4 use it.

**Checkpoint**: `npm run build` succeeds.

---

## Phase 3: User Story 1 - Full-width dashboard with a menu (Priority: P1) 🎯 MVP

**Goal**: no sidebar. A header holds the title and a ☰ menu with Sync now and Theme, and the dashboard spans the full width.

**Independent Test**:
1. Open the app: there is no sidebar, and the header shows the title and ☰.
2. The ☰ menu offers Sync now (with progress; the dashboard refreshes afterwards) and Theme (applies immediately and is remembered).
3. An outside click and Escape close the menu.

### Implementation for User Story 1

- [X] T003 [P] [US1] Create `frontend/src/components/HeaderMenu.jsx` with these props: `{ syncing, onSync, showClosed, onToggleClosed, themeKey, setThemeKey, extraItems }`.
  - **Button**: a ☰ button with `aria-label="Menu"` and `aria-expanded={open}`.
  - **Dropdown**: absolutely positioned, right-aligned under the button, `zIndex: 10`, `background: var(--card)`, `border: 1px solid var(--border)`, borderRadius 4, padding 12, minWidth 220. Items, in order:
    - (a) "↻ Sync now", or "↻ Syncing…" and disabled while `syncing`. On click: close the menu, then call `onSync()`.
    - (b) a "Show closed projects" checkbox row bound to `showClosed` / `onToggleClosed`. Render it only when `onToggleClosed` is given; US3 wires it up.
    - (c) `extraItems`, if given (US1 interim slot for € Turnover; removed in US2).
    - (d) `<ThemeSelector themeKey setThemeKey />`.
  - **Closing**: while open, `useEffect` adds a document `mousedown` listener (close when the target is outside the wrapper `ref`) and a `keydown` listener (close on Escape), and removes both on cleanup.
- [X] T004 [P] [US1] In `frontend/src/index.css`, rename the `.sidebar` rule to `.app-header`. Keep the palette variables and update the comment to "Header: InvoiceNinja dark palette (always fixed)". The open dropdown inherits these variables because it renders inside the header.
- [X] T005 [US1] In `frontend/src/App.jsx`, replace the `<aside className="sidebar">` with a full-width `<header className="app-header">`.
  - **Root layout**: change the root `div` from `display: flex` (row) to a column: `display: flex; flexDirection: column; minHeight: 100vh`.
  - **Header**: `display: flex; alignItems: center; justifyContent: space-between; padding: 12px 36px; borderBottom: 1px solid var(--border); position: relative`.
    - Left: "Burndown" (fontSize 20, weight 700, `var(--accent)`) and "via InvoiceNinja" (fontSize 11, `var(--muted)`), inline with a gap of 10.
    - Right: `<HeaderMenu syncing={syncing} onSync={handleSync} themeKey={themeKey} setThemeKey={setThemeKey} extraItems={…€ Turnover button (same onClick as today, closes nothing extra)…} />`.
  - Remove the sidebar's Sync, € Turnover and ThemeSelector elements, and the `ThemeSelector` import. Keep the `HeaderMenu` import.
  - `<main>` keeps `padding: 32px 36px` and fills the width (`flex: 1`).
- [X] T006 [US1] Make sure the sync-error banner in `frontend/src/App.jsx` still renders at the top of `<main>` in every view, and that `TimesheetModal` still opens from TimesheetSummary blocks (FR-008, US1 scenario 5).

**Checkpoint**: `npm run build` succeeds. Quickstart checks 1 (except "no € Turnover"), 2 and 7 pass.

---

## Phase 4: User Story 2 - Year switching in the AI Dashboard's turnover overview (Priority: P1)

**Goal**: ‹ / › in the dashboard's turnover overview replace the separate turnover view and its button. The same block appears under the AI-unavailable message (Q3 → A, FR-005a).

**Independent Test**:
1. ‹ / › in the dashboard's turnover block show other years, with the same figures as `GET /api/turnover?year=`, and without regenerating the dashboard. › is disabled at the current year.
2. There is no € Turnover anywhere.
3. With the AI unavailable, the turnover block, including ‹ / ›, shows below the message.

### Implementation for User Story 2

- [X] T007 [US2] Rework `frontend/src/components/TurnoverOverview.jsx` into a dashboard block. Signature: `TurnoverOverview({ initialYear })`.
  - `year` state starts at `initialYear ?? new Date().getFullYear()`.
  - Keep the fetch effect on `[year, retry]` and the `years` / `idx` logic unchanged.
  - Remove the `<h1>Turnover</h1>` page heading, the `reloadKey` / `onSelectProject` props, the `hovered` state, and the row `role` / `tabIndex` / `onClick` / `onKeyDown` / hover handlers. Rows are plain `<tr>`.
  - Layout: one `cardStyle` box with `marginBottom: 16`. Inside, a header row (`display: flex; alignItems: center; gap: 8; marginBottom: 12`):
    - "TURNOVER" (fontSize 11, `var(--muted)`, flex 1);
    - ‹ (aria-label "Previous year");
    - the year (fontSize 13, weight 600, minWidth 48, centred);
    - › (aria-label "Next year").
    - Use the existing `navButton` styles and disabled rules.
  - The loading, error and Retry, empty ("No invoices in {year}"), table, total row and `TurnoverFooter` stay as they are.
- [X] T008 [US2] Replace `frontend/src/components/ai/TurnoverOverview.ai.jsx` with a thin wrapper.
  - Keep `resolveYear(year)`.
  - `export default function TurnoverOverviewAI({ props: { year } }) { return <TurnoverOverview initialYear={resolveYear(year)} />; }`
  - Import from `../TurnoverOverview.jsx`, and drop the now-unused imports (`fetchTurnover` and the `ProjectTurnover.jsx` helpers).
- [X] T009 [US2] In `frontend/src/components/ai/AIDashboard.jsx`, in the `status === 'unavailable'` branch, render `<div style={{ textAlign: 'left', marginTop: 32 }}><TurnoverOverview /></div>` below the existing message and the "appears automatically" hint, after importing `TurnoverOverview` from `../TurnoverOverview.jsx`. The existing auto-retry effect replaces both when the AI is back.
- [X] T010 [US2] In `frontend/src/App.jsx`:
  - remove the € Turnover `extraItems` passed to `HeaderMenu`, the `view` state, the `turnoverKey` state, `openProjectFromTurnover`, the `TurnoverOverview` import, and the `view === 'turnover'` branch;
  - always render `<AIDashboard …/>` in `<main>`;
  - `handleSync` bumps only `aiReloadKey`.
- [X] T011 [US2] Remove the `extraItems` prop and its rendering from `frontend/src/components/HeaderMenu.jsx`, since there are no callers left.

**Checkpoint**: `npm run build` succeeds. Quickstart checks 1, 3 and 6 pass.

---

## Phase 5: User Story 3 - Show closed projects on demand (Priority: P2)

**Goal**: a "Show closed projects" toggle in the menu, off by default and remembered per browser. When on, a "Closed projects" section below the generated layout shows a card (with `CLOSED` badge) and a burndown per closed project, or a card and project turnover for lump-sum projects. There is no timesheet block and no regeneration.

**Independent Test**:
1. Toggle on: the section appears at once, with every closed project.
2. Toggle off: it disappears.
3. Reload: the state is kept.
4. A closed lump-sum project shows a card and turnover, never a burndown or timesheet.

### Implementation for User Story 3

- [X] T012 [P] [US3] In `frontend/src/components/ai/ProjectCard.ai.jsx`:
  - import `Badge` from `../Badge.jsx`;
  - in the hourly card, render `{project.status === 'closed' && <Badge>CLOSED</Badge>}` as the first item of the right-hand flex group, before `StatusBadge`;
  - in `LumpSumCard`, replace the inline `LUMP SUM` span with `<Badge>LUMP SUM</Badge>`, and add the same `CLOSED` badge before it. `LumpSumCard` needs `status` from the project.
- [X] T013 [P] [US3] In `frontend/src/components/ai/TimesheetSummary.ai.jsx`, extend the early-return guard so it also returns null when `project?.status === 'closed'`. Closed projects have no timesheet block (US3 scenario 2). Rename `isLumpSum` to `noTimesheet = isLumpSum || isClosed` and keep it in the effect dependencies.
- [X] T014 [US3] In `frontend/src/components/ai/AIDashboard.jsx`:
  - accept the prop `showClosed = false`;
  - add an in-file `closedOrder(a, b)` that mirrors the API's `displayOrder`: hourly before lump sum; hourly by `progress` descending; lump sum by `lump_sum?.earned_pct ?? -1` descending;
  - add an in-file `ClosedProjects({ projects })` component:
    - filter `projects` to `status === 'closed'` and sort with `closedOrder`;
    - render a heading `CLOSED PROJECTS` (fontSize 11, `var(--muted)`, marginTop 24, marginBottom 12);
    - per project, a `<React.Fragment key={p.id}>` with `<ProjectCardAI props={{ projectId: p.id }} />`, then `<ProjectTurnoverAI props={{ projectId: p.id }} />` for lump-sum projects, else `<BurndownChartAI props={{ projectId: p.id }} />`;
    - with no closed projects, show "No closed projects." (fontSize 12, `var(--muted)`);
    - import the three blocks from `./ProjectCard.ai.jsx`, `./ProjectTurnover.ai.jsx` and `./BurndownChart.ai.jsx`;
  - in the streaming / ready return, inside `AIDashboardContext.Provider`, render `{showClosed && status === 'ready' && <ClosedProjects projects={projects} />}` after the `Renderer`.
- [X] T015 [US3] In `frontend/src/App.jsx`:
  - add `const [showClosed, setShowClosed] = useState(() => localStorage.getItem('burndown_show_closed') === '1');`;
  - add `const toggleClosed = (on) => { setShowClosed(on); localStorage.setItem('burndown_show_closed', on ? '1' : '0'); };`;
  - pass `showClosed={showClosed} onToggleClosed={toggleClosed}` to `<HeaderMenu>`, and `showClosed={showClosed}` to `<AIDashboard>`.
- [X] T016 [US3] Check the `BurndownChart.ai.jsx` and `ProjectTurnover.ai.jsx` blocks in `frontend/src/components/ai/` with a closed project ID. They must render from `props.projectId` alone and need no AI-specific context beyond `AIDashboardContext`. Fix any assumption that the project is in progress, if there is one.

**Checkpoint**: `npm run build` succeeds. Quickstart check 5 passes.

---

## Phase 6: User Story 4 - Lump-sum projects recognisable in the turnover overview (Priority: P2)

**Goal**: rows of lump-sum projects in the turnover overview carry a `LUMP SUM` badge. The amounts and totals are unchanged.

**Independent Test**: for a year with a lump-sum project's invoices, its row shows `LUMP SUM`, hourly rows show none, and the total equals the value before the change.

### Tests for User Story 4

- [X] T017 [P] [US4] In `api/tests/turnover.test.js`, in `describe('getYearTurnover')`:
  - (a) Narrow the test "does not filter by billing mode — lump-sum projects stay in the totals (008 SC-003)": it asserts that the part of each SQL statement after `WHERE` (up to `GROUP BY` / `ORDER BY`) contains neither `tags` nor `custom_value`, instead of checking the whole SQL.
  - (b) Add the test "adds billing_mode per row from the project tags":
    - the mocked first query returns rows `{ id: 7, name: 'A', invoiced: '100', paid: '0', invoice_count: '1', tags: [{ name: ' pauschalabrechnung ' }] }` and `{ id: 3, …, tags: [] }`, plus a row with `tags: null`;
    - expect `billing_mode` `'lump_sum'`, `'hourly'`, `'hourly'`;
    - expect that no row in `t.projects` has a `tags` property, and that `t.total` is unchanged.
  - Run the tests and confirm (b) fails before T018.

### Implementation for User Story 4

- [X] T018 [US4] In `api/src/services/turnover.js`, `getYearTurnover`:
  - add `p.raw->'tags' AS tags` to the first SELECT, with `GROUP BY p.id, p.name, p.raw->'tags'`;
  - leave the WHERE clause and ORDER BY unchanged;
  - import `isLumpSum` from `./lump-sum.js`;
  - map rows as `({ tags, ...r }) => ({ id: r.id, name: r.name, ...toTurnoverRow(r), billing_mode: isLumpSum(tags) ? 'lump_sum' : 'hourly' })`. Make sure `totalOf(res.rows)` still receives the amounts.
  - Run `npm test` in `api/`: everything is green.
- [X] T019 [US4] In `frontend/src/components/TurnoverOverview.jsx`, render the project name cell as `<td style={{ padding: '6px 0', fontWeight: 600 }}>{p.name}{p.billing_mode === 'lump_sum' && <span style={{ marginLeft: 8 }}><Badge>LUMP SUM</Badge></span>}</td>`, after importing `Badge` from `./Badge.jsx`.

**Checkpoint**: API tests are green, at the baseline count plus 1. Quickstart check 4 passes.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `README.md`:
  - **"AI Dashboard → Dashboard"**:
    - a header with ☰ holds Sync now, Show closed projects and Theme;
    - there is no sidebar;
    - when the AI is unavailable, the status message is shown with the turnover overview, including ‹ / ›, below it.
  - **"Turnover"**:
    - the dashboard's turnover overview has ‹ / › year switching;
    - there is no € Turnover button or separate view, and no row click;
    - lump-sum rows show a `LUMP SUM` badge;
    - `/api/turnover` rows contain `billing_mode`.
  - **Closed projects**: when the toggle is on, a "Closed projects" section shows a card (`CLOSED`) and burndown per closed project, or a card and turnover for lump-sum projects. There is no timesheet block. The choice is remembered per browser, and the section is not generated by the AI.
  - **Lump-sum table**: add the `LUMP SUM` badge to the Turnover overview row.
  - Remove every remaining "sidebar" / "€ Turnover in the sidebar" wording.
- [X] T021 Run `grep -rn -i "sidebar\|€ Turnover\|onSelectProject\|turnoverKey\|reloadKey" README.md frontend/src`, and remove leftovers that refer to the removed sidebar or turnover view. Unrelated matches are fine.
- [X] T022 Run `npm test` in `api/` (baseline + 1, all green) and `npm run build` in `frontend/`. Then build the frontend Docker image (`docker compose -p ls010 -f docker-compose.yml -f docker-compose.dev.yml build frontend api`). Record the results under "Notes".
- [X] T023 Run the browser checks 1–7 from `specs/010-header-menu-closed-projects/quickstart.md` (check 6 on a test stack only; do not pull or delete models on the shared macmini host). Record the results under "Notes". The operator verifies on macmini after a manual Portainer redeploy.

---

## Dependencies & Execution Order

- **T001**: first (baseline).
- **T002 (Badge)**: before T012 (US3) and T019 (US4).
- **US1 (T003–T006)**: T003 and T004 in parallel, then T005 → T006 (App.jsx).
- **US2 (T007–T011)**: after US1, since T010 removes the interim € Turnover item from T005. T007 → T008 → T009 (T009 needs the block from T007). T010 → T011.
- **US3 (T012–T016)**: after US1 (menu) and US2 (T010 reshapes App.jsx). T012 and T013 run in parallel. T014 (AIDashboard.jsx, after T009) → T015 (App.jsx) → T016.
- **US4 (T017–T019)**: the API part (T017 → T018) can run at any time, in parallel with US1–US3. T019 needs T007 and T002.
- **Polish (T020–T023)**: T020 can run any time after the behaviour is settled. T021 → T022 → T023 run last.

### Parallel Opportunities

- T003 (HeaderMenu.jsx) ∥ T004 (index.css) ∥ T017/T018 (API).
- T012 (ProjectCard.ai.jsx) ∥ T013 (TimesheetSummary.ai.jsx).
- T020 (README) alongside the US3 and US4 frontend tasks.

### Parallel Example

```text
Task: "T003 Create frontend/src/components/HeaderMenu.jsx"
Task: "T004 Rename .sidebar to .app-header in frontend/src/index.css"
Task: "T017 Add billing_mode tests in api/tests/turnover.test.js"
```

---

## Implementation Strategy

### MVP (US1 + US2)

US1 alone already removes the sidebar, keeping € Turnover as a temporary menu item. Together with US2, the € Turnover view is fully replaced by year switching, which is the user's first request. Ship US1 and US2 together.

### Incremental Delivery

1. Setup and Badge.
2. US1: header and menu.
3. US2: year switching in the block, turnover under the AI-unavailable message, € Turnover removed.
4. US3: closed-projects toggle and section.
5. US4: `billing_mode` in the API and the `LUMP SUM` badge in the overview (the API part can go first).
6. Polish: README, the leftover grep, tests and build, and the browser checks.

---

## Notes

- Baseline (T001): API 198 tests passed; frontend build OK.
- US1 and US2 were implemented in one pass, so the interim € Turnover menu item (T005 `extraItems`) was never added and T011 was not needed.
- The closed section renders `ProjectCardAI` + `BurndownChartAI` for every closed project. `BurndownChartAI` already shows the project turnover for lump-sum projects (feature 008 guard), so no separate `ProjectTurnoverAI` import was needed (T014/T016).
- Results (T022):
  - API 199 tests passed (baseline + 1; the 008 no-filter test was narrowed to the WHERE clause);
  - frontend build OK; api and frontend Docker images build;
  - the new turnover SQL (`GROUP BY … p.raw->'tags'`) was checked on a throwaway Postgres 16: same rows and amounts, tags per row.
- Leftover grep (T021): only unrelated matches remain (`reloadKey` in TimesheetModal and ProjectTurnover, `aiReloadKey`).
- Browser checks (T023): the operator confirmed on 2026-11-26 that everything works as designed.
