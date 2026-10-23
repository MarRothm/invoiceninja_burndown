# Tasks: EUR Equivalent of Timesheet Totals

**Input**: Design documents from `specs/004-timesheet-eur-amount/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: API tests (Vitest) are included because the plan lists updates to `api/tests/timesheet.test.js` and `api/tests/routes.test.js` (Constitution: `test.yml` must stay green). No frontend tests (feature 003, research R8) — frontend behaviour is validated via [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Confirm the rate is available in synced data before building on it (research R1)

- [X] T001 (Done via InvoiceNinja source — see research R1 Verification; live SQL check moved to T016.) Start the stack (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`), trigger **↻ Sync now**, and run `SELECT id, name, raw->>'task_rate' AS task_rate FROM projects ORDER BY id;` (quickstart step 1). Record the result in `specs/004-timesheet-eur-amount/research.md` under R1 "Verification". If the `task_rate` key is missing from `raw`, stop and revisit R1 with the user before continuing

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Pure rate/amount helpers used by every story

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Add exported pure helpers to `api/src/services/timesheet.js`: `parseRate(value)` → `parseFloat(value)` if finite and `> 0`, else `null` (research R2); `amountFor(hours, rate)` → `rate === null ? null : round2(hours * rate)` (reuse the existing `round2`). Add JSDoc comments matching the existing style in that file
- [X] T003 [P] Add exported pure helpers to `frontend/src/utils/timesheet.js`: `formatEUR(amount)` → `null` gives `'—'`, otherwise `amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'` (e.g. `3562.5` gives `'3,562.50 €'`); `formatRate(rate)` → `` `@ ${formatEUR(rate)}/h` `` (e.g. `'@ 95.00 €/h'`). Leave `toTSV`/`toCSV` untouched (FR-008)
- [X] T004 [P] Add `describe('parseRate')` and `describe('amountFor')` to `api/tests/timesheet.test.js`: `parseRate` for `95`, `'95.5'`, `0`, `'0'`, `null`, `undefined`, `''`, `'abc'`, `-10` (only the first two give numbers); `amountFor(37.5, 95) === 3562.5`, `amountFor(0, 95) === 0`, `amountFor(10, null) === null`, rounding to cents (`amountFor(1/3, 100) === 33.33`)

**Checkpoint**: Helpers available and tested — `cd api && npm test` green

---

## Phase 3: User Story 1 — See the month total as a EUR amount (Priority: P1) 🎯 MVP

**Goal**: The timesheet footer shows the month total in EUR together with the rate used

**Independent Test**: Open the timesheet of a project with a known `task_rate`, check that the footer shows `@ <rate> €/h` and `total × rate` rounded to the cent; toggle `1.75 / 1:45` and switch months (quickstart steps 2, 3.1, 3.3, 3.4)

### Tests for User Story 1

- [X] T005 [P] [US1] In `api/tests/routes.test.js` → `describe('GET /api/projects/:id/timesheet')`: add a test where the mocked `getTimesheet` resolves with `rate: 95, amount: 3562.5`, and assert both fields appear unchanged in the 200 response body

### Implementation for User Story 1

- [X] T006 [US1] In `getTimesheet` in `api/src/services/timesheet.js`: change the project query to `SELECT id, name, raw->>'task_rate' AS task_rate FROM projects WHERE id = $1`, compute `const rate = parseRate(project.task_rate)`, keep the month sum unrounded (`monthHours`), return `total: round2(monthHours)`, `rate`, `amount: amountFor(monthHours, rate)`. Update the function's JSDoc return shape (contract: `specs/004-timesheet-eur-amount/contracts/timesheet-api.md`)
- [X] T007 [US1] In the footer of `frontend/src/components/TimesheetModal.jsx`, below the existing `Total` row (only when `ready`), add a second row with `formatRate(data.rate)` on the left (11px, `var(--muted)`) and `formatEUR(data.amount)` on the right (`var(--accent)`, `fontVariantNumeric: 'tabular-nums'`), right-aligned like the hours total. Show it only when `data.rate !== null` for now (no-rate handling comes in US3). Import the helpers from `../utils/timesheet.js`; use only existing CSS variables (contract: `contracts/timesheet-ui.md`)

**Checkpoint**: Month EUR amount visible and correct; Copy month / CSV unchanged

---

## Phase 4: User Story 2 — See EUR equivalents of weekly subtotals (Priority: P2)

**Goal**: Every weekly subtotal row also shows its EUR amount, including edge weeks

**Independent Test**: For a month with bookings in several weeks, each subtotal row shows `week hours × rate`; edge weeks labelled "incl. days from other month" use the full Mon–Sun hours (quickstart steps 2, 3.2)

### Tests for User Story 2

- [X] T008 [P] [US2] In `api/tests/timesheet.test.js` → existing `buildWeeks` tests: add cases calling `buildWeeks(month, rows, rate)`. Check that a week with `12.25` h at rate `80` has `amount === 980`; that an edge week's amount uses the full-week hours including neighbouring-month rows; that the amount is computed from the unrounded sum (e.g. three rows of `0.333` at rate `100` give `99.9`); and that `buildWeeks(month, rows)` without a rate gives `amount: null` on every week

### Implementation for User Story 2

- [X] T009 [US2] In `api/src/services/timesheet.js`: extend `buildWeeks(month, rows, rate = null)` so each week gets `amount: amountFor(sum, rate)`, computed from the unrounded `sum` and placed after `hours`. In `getTimesheet`, pass `rate` to `buildWeeks`. Update the JSDoc return shape
- [X] T010 [US2] In the weekly subtotal row of `frontend/src/components/TimesheetModal.jsx`: wrap the hours `<span>` in a right-aligned column and add `formatEUR(week.amount)` below it (11px, `var(--muted)`, tabular numbers). Show it only when `data.rate !== null` for now

**Checkpoint**: Weekly EUR amounts visible; US1 still works

---

## Phase 5: User Story 3 — Handle projects without an hour rate (Priority: P2)

**Goal**: Projects without a rate show `—` and "No hour rate set" instead of a misleading `0.00 €`

**Independent Test**: Open the timesheet of a project whose `task_rate` is `0`/missing: footer and weekly rows show `—` and the hint, hours unchanged (quickstart steps 2, 3.5)

### Tests for User Story 3

- [X] T011 [P] [US3] In `api/tests/routes.test.js`: add a test where the mocked `getTimesheet` resolves with `rate: null, amount: null, weeks: [{ …, amount: null }]`, and assert that the 200 response keeps the `null`s (not `0`) and that `total` stays unchanged

### Implementation for User Story 3

- [X] T012 [US3] In `frontend/src/components/TimesheetModal.jsx`: remove the `data.rate !== null` guards from T007 and T010. When `data.rate === null`, the footer EUR row shows `No hour rate set` (11px, `var(--muted)`) instead of the rate and `—` instead of the amount, and weekly rows show `—`. Hour values and the Copy/Download buttons stay unaffected (FR-007)

**Checkpoint**: All three stories work independently

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T013 [P] Update the `## Timesheet` section of `README.md`: add a bullet saying the footer and weekly subtotals show the EUR equivalent at the project's InvoiceNinja **task rate** (set on the project in InvoiceNinja; `—` / "No hour rate set" if none), computed from unrounded hours, display-only (not part of Copy month or the CSV), no VAT
- [X] T014 [P] Update the 003 API contract note in `specs/003-timesheet-monthly-export/contracts/timesheet-api.md` with one line pointing to `specs/004-timesheet-eur-amount/contracts/timesheet-api.md` for the `rate`/`amount` fields
- [X] T015 Run `cd api && npm test` and confirm all tests are green
- [ ] T016 Run the full [quickstart.md](quickstart.md) walkthrough via `docker compose … up -d --build` (Constitution: Docker-first validation), including step 6 (Copy month / CSV unchanged) and step 7 (light/dark themes)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 gates everything (confirms the rate source)
- **Foundational (Phase 2)**: depends on T001; blocks all stories
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2. T009 edits `getTimesheet` after T006 (same file), and T010 edits the same component as T007, so run it after US1
- **US3 (Phase 5)**: depends on T007 and T010 (removes their guards); the API side is already covered by `parseRate`/`amountFor` in Phase 2
- **Polish (Phase 6)**: after all desired stories

### Within Each Story

- Tests are written first and should fail (T005 passes trivially because the route passes data through; it guards against future filtering)
- API service changes before UI changes

### Parallel Opportunities

- Phase 2: T002, T003 and T004 (three different files)
- US1: T005 in parallel with T006
- US2: T008 in parallel with T009 → T010
- US3: T011 in parallel with T012
- Polish: T013 and T014 in parallel

---

## Parallel Example: Phase 2

```bash
Task: "Add parseRate/amountFor to api/src/services/timesheet.js"        # T002
Task: "Add formatEUR/formatRate to frontend/src/utils/timesheet.js"     # T003
Task: "Add parseRate/amountFor tests to api/tests/timesheet.test.js"    # T004
```

## Parallel Example: User Story 2

```bash
Task: "buildWeeks amount tests in api/tests/timesheet.test.js"          # T008
Task: "buildWeeks(month, rows, rate) in api/src/services/timesheet.js"  # T009
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001: verify `task_rate` is synced
2. Phase 2: helpers + tests
3. Phase 3: month EUR amount in API and footer
4. **Stop and validate**: quickstart steps 2, 3.1, 3.3, 3.4

### Incremental Delivery

1. MVP (US1) → month amount
2. US2 → weekly amounts
3. US3 → explicit no-rate state (until then, projects without a rate simply show no EUR row, which is already non-misleading)
4. Polish → README, contract cross-link, full Docker validation

---

## Notes

- One commit per phase or logical group, `feat:` / `test:` / `docs:` prefixes per the constitution
- Do not touch `toTSV`, `toCSV`, `fileName` or single-value copy (FR-008)
- No schema, sync, env var or dependency changes in this feature
