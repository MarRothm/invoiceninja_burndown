# Tasks: Project Turnover by Year

**Input**: Design documents from `specs/005-project-turnover-by-year/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: API tests (Vitest) are included because the plan lists `api/tests/turnover.test.js`, updates to `invoiceninja.test.js` and `routes.test.js` (Constitution: `test.yml` must stay green). No frontend tests (as in features 003/004) — UI is validated via [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1, US2)

---

## Phase 1: Setup

**Purpose**: Schema for invoices on new and existing databases (research R5)

- [X] T001 [P] In `init.sql`: after the `sync_state` table, add `CREATE TABLE IF NOT EXISTS invoices` with the columns from `specs/005-project-turnover-by-year/data-model.md` (`project_id INT REFERENCES projects(id) ON DELETE SET NULL`, `amount`/`paid_to_date NUMERIC(12,2) NOT NULL DEFAULT 0`, `status_id SMALLINT NOT NULL`, `is_deleted BOOLEAN NOT NULL DEFAULT false`, `raw JSONB`, timestamps), the partial index `idx_invoices_project_date ON invoices (project_id, invoice_date) WHERE NOT is_deleted AND status_id IN (2, 3, 4)`, and add `('invoices')` to the existing `INSERT INTO sync_state (resource) VALUES … ON CONFLICT DO NOTHING`
- [X] T002 [P] Create `api/src/db/schema.js` exporting `async function ensureSchema()` that runs, via `query` from `./pool.js`, exactly the same three idempotent statements as T001 (table, index, `INSERT INTO sync_state (resource) VALUES ('invoices') ON CONFLICT DO NOTHING`). Add a comment explaining that `init.sql` only runs on a fresh volume, so existing deployments get the table here
- [X] T003 Call `await ensureSchema()` in `api/src/worker.js` before the initial `runFullSync()`, and in `api/src/server.js` before `fastify.listen`. If it fails, log `[schema] …` and exit with code 1, so the container restarts instead of syncing into a missing table

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Invoice sync and shared aggregation helpers, needed by both stories

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] In `api/src/services/invoiceninja.js`, add `fetchInvoices(updatedAfter)`. Copy `fetchTasks` (pagination with `per_page` 500 and `page`, stop when fewer than 500 records come back, `updated_at` as unix seconds), but call `/invoices` and add `status: 'active,archived,deleted'` (research R3). Also add a pure exported `mapInvoice(inv)` that returns `{ invoiceninja_id: inv.id, invoiceninja_project_id: inv.project_id || null, number: inv.number || null, invoice_date: inv.date || null, amount: parseFloat(inv.amount) || 0, paid_to_date: parseFloat(inv.paid_to_date) || 0, status_id: parseInt(inv.status_id, 10) || 1, is_deleted: !!inv.is_deleted }`
- [X] T005 [P] In `api/tests/invoiceninja.test.js`, add `describe('mapInvoice')` with these cases: a full invoice with string `status_id: '4'` maps to the number `4`; `date: ''` becomes `invoice_date: null`; `project_id: ''` becomes `null`; a missing `status_id` defaults to `1`; numeric strings for `amount`/`paid_to_date` are parsed; `is_deleted: true` is kept
- [X] T006 In `api/src/services/sync.js`, add `export async function syncInvoices()`. Mirror `syncProjects`: use the `getLastSynced('invoices')` cursor, `fetchInvoices(since)` and `mapInvoice`, and resolve `project_id` with `SELECT id FROM projects WHERE invoiceninja_id = $1` (an unknown id becomes NULL). Upsert with `INSERT … ON CONFLICT (invoiceninja_id) DO UPDATE` on every column including `project_id`, `status_id`, `is_deleted` and `raw`, then call `setLastSynced('invoices', now)` and return the count. In `runFullSync`, call it after `syncTimeEntries()`, add `invoices` to the log line, and return `{ projects, entries, invoices, ms }`
- [X] T007 [P] Create `api/src/services/turnover.js` with:
  - pure exported `parseYear(raw)`, which accepts only `^\d{4}$` strings between 2000 and 2100 and returns the number or `null`
  - pure exported `toTurnoverRow({ invoiced, paid, invoice_count })`, which returns `{ invoiced: round2(i), paid: round2(p), open: round2(i - p), invoice_count: parseInt(...) || 0 }` after `parseFloat` of the NUMERIC strings
  - a module constant `COUNTED`, the SQL `WHERE` fragment from data-model "Counted invoice": `i.project_id IS NOT NULL AND i.invoice_date IS NOT NULL AND NOT i.is_deleted AND i.status_id IN (2, 3, 4) AND NOT COALESCE((p.raw->>'is_deleted')::boolean, false) AND p.archived_at IS NULL`, for `invoices i JOIN projects p ON p.id = i.project_id`
  - a helper `lastSynced()` that reads `sync_state` for `invoices` and returns `null` for the epoch, the same way `getTimesheet` does

  Use the JSDoc style of `api/src/services/timesheet.js`
- [X] T008 [P] Create `api/tests/turnover.test.js`, mocking `../src/db/pool.js` like `api/tests/timesheet.test.js`. Test `parseYear`: `'2026'` returns `2026`; `'26'`, `'1999'`, `'2101'`, `'2026a'`, `''`, `undefined` and `['2026']` return `null`. Test `toTurnoverRow`: NUMERIC strings are parsed; `open = invoiced − paid`; values are rounded to cents; `invoiced` equals `paid + open` for `{ invoiced: '0.1', paid: '0.2' }`-style float cases

**Checkpoint**: `POST /api/sync` fills `invoices`; `cd api && npm test` green

---

## Phase 3: User Story 1 — Invoiced and paid amounts per year for a project (Priority: P1) 🎯 MVP

**Goal**: The legacy project detail view shows a per-year table (newest first) with invoiced, paid and open amounts, a total row, "No invoices yet" when there are none, and the last sync time

**Independent Test**: For a project with invoices in two years, the table matches InvoiceNinja per year; a December invoice paid in January counts as paid in the invoice year (quickstart steps 2, 3.1–3.3)

### Tests for User Story 1

- [X] T009 [P] [US1] In `api/tests/turnover.test.js`, add `describe('getProjectTurnover')` with mocked `query` results:
  - an unknown project returns `null`
  - grouped rows for 2025 and 2026 come back as `years` newest first, with `total` equal to the sum
  - no rows give `years: []` and an all-zero `total`
  - `last_synced_at` is an ISO string, or `null` for the epoch
  - the year SQL contains `status_id IN (2, 3, 4)`, which proves `COUNTED` is used
- [X] T010 [P] [US1] In `api/tests/routes.test.js`, add `getProjectTurnover: vi.fn(async () => null)` to a new `vi.mock('../src/services/turnover.js', …)`. Keep the real `parseYear` via `importActual`, as is done for `parseMonth`. Add `describe('GET /api/projects/:id/turnover')` with three cases: 200 passes the payload through, 404 returns `Project not found`, and 400 for id `abc`. Also update the existing sync test's mock and assertion to include `invoices`

### Implementation for User Story 1

- [X] T011 [US1] In `api/src/services/turnover.js`, add `export async function getProjectTurnover(projectId)`:
  - Run `SELECT id, name FROM projects WHERE id = $1` and return `null` if there's no row.
  - Run `SELECT EXTRACT(YEAR FROM i.invoice_date)::int AS year, SUM(i.amount) AS invoiced, SUM(i.paid_to_date) AS paid, COUNT(*) AS invoice_count FROM invoices i JOIN projects p ON p.id = i.project_id WHERE p.id = $1 AND ${COUNTED} GROUP BY 1 ORDER BY 1 DESC`.
  - Return `{ project, years: rows.map(r => ({ year: r.year, ...toTurnoverRow(r) })), total, last_synced_at }`.
  - Compute `total` with `toTurnoverRow` from the **unrounded** row sums.

  The payload follows `contracts/turnover-api.md`.
- [X] T012 [US1] In `api/src/routes/projects.js`, import `getProjectTurnover` and add `GET /projects/:id/turnover`, following the timesheet route: `parseId` → 400 `Invalid project id`, `null` → 404 `Project not found`
- [X] T013 [P] [US1] In `frontend/src/hooks/api.js`, add `fetchProjectTurnover(projectId)`, following `fetchTimesheet` and throwing `Error('Failed to fetch turnover')`
- [X] T014 [US1] Create `frontend/src/components/ProjectTurnover.jsx` (props `projectId`, `reloadKey`) following `contracts/turnover-ui.md` "Per-project table":
  - Fetch with `fetchProjectTurnover`, and use a cancel flag on unmount/prop change as in `TimesheetModal`.
  - Show "Loading...", or an error message with a Retry button.
  - Render a "Turnover" heading and a table with Year | Invoiced | Paid | Open, right-aligned, `fontVariantNumeric: 'tabular-nums'`, amounts via `formatEUR` from `../utils/timesheet.js`, and a bold total row. Show `open > 0` in `var(--accent2)` and `0` in `var(--muted)`.
  - When `years` is empty, show "No invoices yet" instead.
  - Add the footer line `Gross amounts incl. VAT · Last synced: …`, with the date formatted like the timesheet.
  - Use the card styling of the burndown chart container (`var(--card)`, `var(--border)`, radius 4) and existing CSS variables only.
- [X] T015 [US1] In `frontend/src/App.jsx`, add `const [turnoverKey, setTurnoverKey] = useState(0)`, and increment it in `handleSync` after a successful sync. In the legacy detail view, render `<ProjectTurnover projectId={selected.id} reloadKey={turnoverKey} />` below the `<BurndownChart>` block

**Checkpoint**: Per-project turnover works; quickstart steps 2 (first curl), 3.1–3.3 and 3.7 pass

---

## Phase 4: User Story 2 — Compare turnover across projects for one year (Priority: P2)

**Goal**: A `€ Turnover` sidebar entry opens a cross-project overview for one year (default current year), sorted by invoiced amount, with a total row; a row click opens that project's detail view

**Independent Test**: For 2026, every listed project's values equal its per-project 2026 row, the total equals the sum, and projects without 2026 invoices are absent (quickstart steps 2, 3.4–3.6)

### Tests for User Story 2

- [X] T016 [P] [US2] In `api/tests/turnover.test.js`, add `describe('getYearTurnover')` with mocked `query`:
  - project rows come back in SQL order with `toTurnoverRow` values
  - `total` equals the sum of the projects
  - `years_available` is mapped to numbers, newest first
  - no rows give `projects: []` and a zero total
  - the SQL parameter is the year (e.g. `[2026]`) and the SQL contains `status_id IN (2, 3, 4)`
- [X] T017 [P] [US2] In `api/tests/routes.test.js`, add `getYearTurnover: vi.fn(async () => ({ … }))` to the turnover mock and add `describe('GET /api/turnover')`: 200 for `?year=2026`, asserting the mock is called with the **number** `2026`; and 400 `Invalid year, expected YYYY` for `?year=26`, `?year=abcd` and a missing year

### Implementation for User Story 2

- [X] T018 [US2] In `api/src/services/turnover.js`, add `export async function getYearTurnover(year)`, which runs three queries:
  - Projects: `SELECT p.id, p.name, SUM(i.amount) AS invoiced, SUM(i.paid_to_date) AS paid, COUNT(*) AS invoice_count FROM invoices i JOIN projects p ON p.id = i.project_id WHERE ${COUNTED} AND EXTRACT(YEAR FROM i.invoice_date) = $1 GROUP BY p.id, p.name ORDER BY SUM(i.amount) DESC, p.name ASC`
  - `years_available`: `SELECT DISTINCT EXTRACT(YEAR FROM i.invoice_date)::int AS year … WHERE ${COUNTED} ORDER BY 1 DESC`
  - `lastSynced()`

  Return `{ year, years_available, projects, total, last_synced_at }`, with `total` computed from the unrounded sums (contract `contracts/turnover-api.md`)
- [X] T019 [US2] In `api/src/routes/projects.js`, add `GET /turnover`: `const year = parseYear(req.query.year)`; if it's `null`, return 400 `{ error: 'Invalid year, expected YYYY' }`; otherwise return `getYearTurnover(year)`
- [X] T020 [P] [US2] In `frontend/src/hooks/api.js`, add `fetchTurnover(year)` → `GET ${BASE}/turnover?year=${year}`, throwing `Error('Failed to fetch turnover')`
- [X] T021 [US2] Create `frontend/src/components/TurnoverOverview.jsx` (props `reloadKey`, `onSelectProject(projectId)`) following `contracts/turnover-ui.md` "Cross-project overview":
  - `year` state defaults to `new Date().getFullYear()`.
  - The selector is `‹ YEAR ›` and steps through the sorted union of `years_available` and the current year. ‹/› are disabled at either end.
  - The table shows Project | Invoiced | Paid | Open and a bold total row, with amounts via `formatEUR`.
  - Rows are buttons/`role="button"` with a hover background of `var(--surface)` and call `onSelectProject(p.id)`.
  - When there are no projects, show "No invoices in <year>".
  - Use the same loading/error/Retry handling and footer line as `ProjectTurnover`.
- [X] T022 [US2] In `frontend/src/App.jsx`:
  - Add `const [view, setView] = useState('dashboard')`.
  - Add a `€ Turnover` button directly below **↻ Sync now**, with the same style. It shows an accent border when `view === 'turnover'` and toggles `view`.
  - In `<main>`, render `<TurnoverOverview reloadKey={turnoverKey} onSelectProject={…} />` when `view === 'turnover'`, before the AI/legacy branches. Show those branches only when `view === 'dashboard'`.
  - `onSelectProject` finds the project in `projects`, calls `setSelected`, then `setView('dashboard')`, and calls the existing `handleToggle` (or sets `dashMode` to legacy the same way, including the persisted value) if `dashMode === 'ai'` (research R7).
  - Clicking a sidebar project card also sets `view` to `'dashboard'`.

**Checkpoint**: Both stories work; numbers identical between overview and detail table (FR-014)

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T023 [P] Update `README.md`:
  - Add `GET /api/projects/:id/turnover` and `GET /api/turnover?year=YYYY` to the endpoint table.
  - Mention in the sync description that invoices are synced too, and that `POST /api/sync` now returns `invoices`.
  - Add a `## Turnover` section covering: gross amounts, payments counted in the invoice year, which statuses count (sent, partial, paid; archived invoices included; drafts, cancelled, reversed and deleted excluded), credits count as paid, the `€ Turnover` overview, and that the table is created automatically on API/worker start for existing databases.
- [X] T024 [P] In `SECURITY.md`, extend the accepted-risk note: the unauthenticated API now also serves invoice amounts per project and year, so the network-boundary requirement (Constitution I) matters even more
- [X] T025 Run `cd api && npm test` and `cd frontend && npx vite build`; both must pass
- [ ] T026 Run the full [quickstart.md](quickstart.md) walkthrough with `docker compose … up -d --build` **against an existing postgres volume** (step 1 verifies `ensureSchema`, and the archived/deleted invoice check verifies research R3), then steps 2–3 including light/dark themes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 and T002 in parallel; T003 after T002
- **Foundational (Phase 2)**: after Phase 1. T004 and T005 in parallel, then T006 (it uses `fetchInvoices`/`mapInvoice`). T007 and T008 run in parallel with T004–T006
- **US1 (Phase 3)**: after Phase 2
- **US2 (Phase 4)**: after Phase 2. It shares `turnover.js`, `routes/projects.js`, `api.js`, `App.jsx` and the test files with US1, so run it after US1 (it reuses `turnoverKey` from T015)
- **Polish (Phase 5)**: after the desired stories

### Within Each Story

- Write the tests first and check that they fail. Then service → route → frontend helper → component → `App.jsx`

### Parallel Opportunities

- Phase 1: T001 and T002
- Phase 2: T004 and T005 alongside T007 and T008 (four different files)
- US1: T009, T010 and T013 in parallel; then T011 → T012; T014 → T015
- US2: T016, T017 and T020 in parallel; then T018 → T019; T021 → T022
- Polish: T023 and T024

---

## Parallel Example: Phase 2

```bash
Task: "fetchInvoices + mapInvoice in api/src/services/invoiceninja.js"   # T004
Task: "mapInvoice tests in api/tests/invoiceninja.test.js"               # T005
Task: "parseYear/toTurnoverRow/COUNTED in api/src/services/turnover.js"  # T007
Task: "parseYear/toTurnoverRow tests in api/tests/turnover.test.js"      # T008
```

## Parallel Example: User Story 1

```bash
Task: "getProjectTurnover tests in api/tests/turnover.test.js"           # T009
Task: "turnover route tests in api/tests/routes.test.js"                 # T010
Task: "fetchProjectTurnover in frontend/src/hooks/api.js"                # T013
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: schema (+ startup migration)
2. Phase 2: invoice sync and helpers
3. Phase 3: per-project turnover table
4. **Stop and validate** with quickstart steps 1, 2 and 3.1–3.3 on an existing volume

### Incremental Delivery

1. MVP (US1): yearly turnover in each project's detail view
2. US2: `€ Turnover` cross-project overview
3. Polish: README, SECURITY.md, full Docker validation

---

## Notes

- One commit per phase or logical group, with `feat:` / `test:` / `docs:` prefixes
- Payments are deliberately not synced (research R1); don't add a payments table
- Never delete invoice rows locally; `is_deleted` excludes them
- The first sync after deployment fetches all invoices (the cursor starts at the epoch)
