# Tasks: Monthly Timesheet for Transfer to External Systems

**Input**: Design documents from `specs/003-timesheet-monthly-export/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/), [quickstart.md](quickstart.md)

**Tests**: API tests (Vitest) are included because the plan lists `api/tests/timesheet.test.js` and route tests (Constitution: `test.yml` must stay green). No frontend tests (research R8) — frontend behaviour is validated via [quickstart.md](quickstart.md).

**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story the task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Create the empty modules so later tasks can be worked in parallel

- [X] T001 [P] Create `api/src/services/timesheet.js` exporting stubs `buildMonthDays(month, rows)` and `getTimesheet(projectId, month)` (ESM, import `query` from `../db/pool.js` like `api/src/services/burndown.js`)
- [X] T002 [P] Create `frontend/src/utils/timesheet.js` exporting stubs `formatHours`, `toTSV`, `toCSV`, `fileName`, `shiftMonth`, `currentMonth`, `copyText` (signatures per `specs/003-timesheet-monthly-export/contracts/timesheet-ui.md`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Month helpers used by both API validation and frontend navigation

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 [P] Implement `currentMonth()` (browser-local `YYYY-MM`) and `shiftMonth(month, delta)` (handles year roll-over, e.g. `'2026-01', -1 → '2025-12'`) in `frontend/src/utils/timesheet.js`
- [X] T004 [P] Add exported `parseMonth(raw)` to `api/src/services/timesheet.js`: accepts only `^\d{4}-(0[1-9]|1[0-2])$` with year 2000–2100, returns `{ year, month, from: 'YYYY-MM-01', to: '<first day of next month>' }` or `null`; compute dates with UTC arithmetic only (`Date.UTC`), never local time

**Checkpoint**: Month parsing/shifting available — user stories can start

---

## Phase 3: User Story 1 — View a monthly timesheet with one daily total (Priority: P1) 🎯 MVP

**Goal**: Operator clicks ▦ on a project (sidebar card or legacy header), sees an overlay with one row per day of the month, the daily sum of completed hours, a month total, last-sync time, and prev/next month navigation (FR-001–FR-006, FR-011–FR-016).

**Independent Test**: Open the timesheet for a project with known entries in September 2026; verify 30 rows, each day equals `SUM(hours)` of completed entries for that date (SQL in quickstart.md), zero days present and muted, weekends shaded, total equals sum of days, `›` disabled on the current month, overlay reachable in both legacy and AI mode.

### Tests for User Story 1

> Write these first and ensure they FAIL before implementation

- [X] T005 [P] [US1] Create `api/tests/timesheet.test.js` with Vitest tests for `buildMonthDays` and `parseMonth`: Feb 2026 → 28 days, Feb 2028 → 29, Sep 2026 → 30, Oct 2026 → 31; missing dates → `hours: 0`; `weekday` is ISO (2026-09-01 → 2 Tuesday, 2026-09-06 → 7); hours rounded to 2 decimals from string inputs (`'1.50'` → `1.5`); `parseMonth` rejects `'2026-13'`, `'2026-1'`, `'abcd-ef'`, `'1999-12'`, `undefined`; `parseMonth('2026-12').to === '2027-01-01'`
- [X] T006 [P] [US1] Extend `api/tests/routes.test.js`: add `vi.mock('../src/services/timesheet.js', …)` with `getTimesheet` and real-shaped `parseMonth` behaviour (or `vi.importActual` for `parseMonth`); test `GET /api/projects/1/timesheet?month=2026-09` → 200 with mocked payload, `?month=2026-13` → 400 `{ error: 'Invalid month, expected YYYY-MM' }`, missing month → 400, `/api/projects/abc/timesheet?month=2026-09` → 400 `Invalid project id`, `getTimesheet` returning `null` → 404 `Project not found`

### Implementation for User Story 1

- [X] T007 [US1] Implement `buildMonthDays(month, rows)` in `api/src/services/timesheet.js`: iterate every UTC day of `month`, map `rows` (`{ date: 'YYYY-MM-DD', hours: string|number }`) to `{ date, weekday (1–7, Monday=1), hours: round2(parseFloat) || 0 }`; return array in ascending order
- [X] T008 [US1] Implement `getTimesheet(projectId, month)` in `api/src/services/timesheet.js`: `SELECT id, name FROM projects WHERE id = $1` (return `null` if none); grouped query from `specs/003-timesheet-monthly-export/data-model.md` with `status = 'completed'` and `[from, to)`; `SELECT last_synced_at FROM sync_state WHERE resource = 'time_entries'` (return `null` if epoch 1970-01-01); return `{ project: { id, name }, month, days, total: round2(sum), last_synced_at }` per `contracts/timesheet-api.md`
- [X] T009 [US1] Add route `GET /projects/:id/timesheet` in `api/src/routes/projects.js` after the burndown route: validate `id` with existing `parseId` (400 `Invalid project id`), `parseMonth(req.query.month)` (400 `Invalid month, expected YYYY-MM`), call `getTimesheet` (404 `Project not found` when `null`); run `cd api && npm test` and make T005/T006 pass
- [X] T010 [P] [US1] Add `fetchTimesheet(projectId, month)` to `frontend/src/hooks/api.js` following the `fetchBurndown` pattern (`${BASE}/projects/${projectId}/timesheet?month=${encodeURIComponent(month)}`, throw `Error('Failed to fetch timesheet')` when `!res.ok`)
- [X] T011 [P] [US1] Implement `formatHours(hours, format)` in `frontend/src/utils/timesheet.js` with only the `'decimal'` branch for now (`Number(hours).toFixed(2)`); default `format = 'decimal'`
- [X] T012 [US1] Create `frontend/src/components/TimesheetModal.jsx` (props `{ project, onClose }`): fixed full-screen backdrop (click closes) with centred panel (`var(--card)`, `1px solid var(--border)`, `borderRadius: 4`, max-width ~520px, max-height 85vh, scrollable body); header "Timesheet — {project.name}" + ✕ button; `Esc` key closes (keydown listener in `useEffect`); month state initialised with `currentMonth()`; `‹` / `›` buttons using `shiftMonth`, `›` disabled when `month === currentMonth()`; month label via `toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })`; fetch with `fetchTimesheet` on `[project.id, month]`, states loading ("Loading…") / error (message + Retry button) / ready; "Last synced: …" line (`en-GB` date+time, or "never"); one row per day showing weekday + `DD MMM` label, ISO date, and `formatHours(day.hours)` right-aligned with tabular numerals; rows with `hours === 0` use `color: var(--muted)`; weekend rows (`weekday >= 6`) use `background: var(--surface)`; footer row "Total" with `formatHours(total)`; styling only via existing CSS variables and font sizes from `design.md` (11–13px), matching inline-style idiom of `frontend/src/App.jsx`
- [X] T013 [US1] Update `frontend/src/components/ProjectCard.jsx`: change root `<button>` to `<div role="button" tabIndex={0}>` keeping the same styles, add `onKeyDown` that calls `onClick` on Enter/Space; accept new prop `onOpenTimesheet`; add a small `<button>` with `▦`, `title="Timesheet"`, `aria-label={\`Open timesheet for ${name}\`}` in the name/badge row (muted colour, transparent background, no border) whose `onClick` calls `e.stopPropagation()` then `onOpenTimesheet()`; render it only when `onOpenTimesheet` is provided
- [X] T014 [US1] Update `frontend/src/App.jsx`: add `const [timesheetProject, setTimesheetProject] = useState(null)`; pass `onOpenTimesheet={() => setTimesheetProject(p)}` to each sidebar `ProjectCard`; in the legacy header add a "▦ Timesheet" button next to the `<h1>` (style like the Sync button: `var(--surface)`, `1px solid var(--border)`, `var(--accent)` text, fontSize 12) calling `setTimesheetProject(selected)`; render `{timesheetProject && <TimesheetModal project={timesheetProject} onClose={() => setTimesheetProject(null)} />}` once at the end of the root `<div>`, outside both the `dashMode` branches, so it works in legacy and AI mode (FR-015, FR-016)

**Checkpoint**: US1 is fully functional — MVP deliverable. Validate quickstart steps 1–3, 8–10, 12.

---

## Phase 4: User Story 2 — Copy or export the timesheet for transfer (Priority: P2)

**Goal**: Copy whole month as TSV, copy a single day's value by clicking it, download CSV (FR-007–FR-009), with a fallback for non-secure HTTP origins.

**Independent Test**: Open a month, click "Copy month", paste into a spreadsheet → N rows × 2 columns; click a single value → paste shows only that value; "Download CSV" → `timesheet_<slug>_<YYYY-MM>.csv` with BOM, `date,hours` header and N rows; works over plain HTTP on a LAN IP.

### Implementation for User Story 2

- [X] T015 [P] [US2] Implement in `frontend/src/utils/timesheet.js`: `toTSV(days, format)` → lines `${date}\t${formatHours(hours, format)}` joined with `\n` (no header); `toCSV(days, format)` → `'﻿' + 'date,hours\r\n' + rows joined with '\r\n' + '\r\n'`; `fileName(projectName, month)` → `timesheet_${slug}_${month}.csv` where slug = lowercase, NFKD-normalised, diacritics removed, non-`[a-z0-9]` runs → `-`, trimmed dashes, fallback `project`
- [X] T016 [P] [US2] Implement `copyText(text)` in `frontend/src/utils/timesheet.js` (async, returns boolean): if `window.isSecureContext && navigator.clipboard`, `await navigator.clipboard.writeText(text)`; otherwise (or on rejection) create an off-screen `<textarea>`, select it, `document.execCommand('copy')`, remove it; return `false` if both fail (research R4)
- [X] T017 [US2] Extend `frontend/src/components/TimesheetModal.jsx` footer with "Copy month" and "Download CSV" buttons (Sync-button style): Copy calls `copyText(toTSV(data.days, format))` and shows transient feedback "Copied {n} days" (~2 s) or inline message "Copy not available — use Download CSV" on `false`; Download builds `new Blob([toCSV(...)], { type: 'text/csv;charset=utf-8' })`, triggers an `<a download={fileName(project.name, month)}>` click and revokes the object URL; buttons disabled while not `ready`
- [X] T018 [US2] Make each day's value in `frontend/src/components/TimesheetModal.jsx` a borderless `<button>` (`title="Copy value"`, `cursor: pointer`) that calls `copyText(formatHours(day.hours, format))` and briefly shows "Copied" (e.g. `var(--accent)` text) on that row; same failure message as T017

**Checkpoint**: US1 + US2 work. Validate quickstart steps 5–7, 11.

---

## Phase 5: User Story 3 — Choose the time display format (Priority: P3)

**Goal**: Toggle decimal (`1.75`) ↔ hours:minutes (`1:45`) for display, copy and download; remembered per browser (FR-010).

**Independent Test**: Toggle to `1:45`; a 1.75 h day shows `1:45`, copied/exported values follow; reload and reopen → still `1:45`.

### Implementation for User Story 3

- [X] T019 [P] [US3] Add the `'hhmm'` branch to `formatHours` in `frontend/src/utils/timesheet.js`: `m = Math.round(hours * 60)` → `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` (0 → `0:00`)
- [X] T020 [US3] In `frontend/src/components/TimesheetModal.jsx` add `format` state initialised from `localStorage.getItem('burndown_timesheet_format') ?? 'decimal'`, persist on change; render a two-segment toggle `[ 1.75 | 1:45 ]` next to the month navigation (active segment `var(--accent)` background, like `DashboardToggle.jsx`); pass `format` to every `formatHours`, `toTSV` and `toCSV` call (rows, total, copy, download)

**Checkpoint**: All user stories independently functional. Validate quickstart step 4.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T021 [P] Update `README.md`: add `GET  /api/projects/:id/timesheet?month=YYYY-MM → Daily totals for one project and month` to the "API Endpoints" block, and a short "Timesheet" section after "Burndown Logic" describing the ▦ entry points, month navigation, Copy month (tab-separated), single-value copy, CSV download, decimal/h:mm toggle, and that only completed entries are counted (Constitution: README currency)
- [X] T022 [P] Accessibility pass in `frontend/src/components/TimesheetModal.jsx`: `role="dialog"`, `aria-modal="true"`, `aria-labelledby` on the title, focus the close button on open and restore focus to the opener on close
- [X] T023 Run `cd api && npm test` (all green) and `cd frontend && npm run build` (no errors)
- [ ] T024 Run the full validation in `specs/003-timesheet-monthly-export/quickstart.md` against `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`, including light/dark theme and AI mode

---

## Phase 7: User Story 1 (Increment 2) — Weekly subtotals (Priority: P1)

**Goal**: Group the timesheet by ISO week (Mon–Sun) with a subtotal row after each Sunday, including the trailing partial week; edge weeks cover the full week incl. neighbouring-month days, shown greyed and not copyable, labelled "incl. days from other month" (FR-017–FR-020, SC-006, US1 scenarios 6–8).

**Independent Test**: September 2026 shows 5 subtotal rows (weeks 36–40, 31 Aug – 04 Oct), each equal to the sum of its 7 rows; 31 Aug and 01–04 Oct are greyed and not clickable; month Total, Copy month and CSV contain only the 30 September days (quickstart steps 13–17).

**Context**: Phases 1–6 are implemented and merged. This phase only extends `api/src/services/timesheet.js`, its tests, `frontend/src/components/TimesheetModal.jsx` and `README.md`. The response change is additive — `days` and `total` keep their month-only meaning (research R10). Design: [research.md](research.md) R9–R12, [data-model.md](data-model.md) "WeeklySubtotal", [contracts/timesheet-api.md](contracts/timesheet-api.md), [contracts/timesheet-ui.md](contracts/timesheet-ui.md).

### Tests for Increment 2

> Write these first and ensure they FAIL before implementation

- [X] T025 [P] [US1] Add tests to `api/tests/timesheet.test.js` for `weekRange(month)` and `isoWeek(date)`: `weekRange('2026-09')` → `{ from: '2026-08-31', to: '2026-10-05' }`; `weekRange('2026-08')` → `{ from: '2026-07-27', to: '2026-09-07' }`; `weekRange('2021-02')` → `{ from: '2021-02-01', to: '2021-03-01' }`; `isoWeek('2026-08-31')` → `{ week: 36, year: 2026 }`, `isoWeek('2026-12-28')` → `{ week: 53, year: 2026 }`, `isoWeek('2025-12-29')` → `{ week: 1, year: 2026 }`, `isoWeek('2021-01-03')` → `{ week: 53, year: 2020 }`
- [X] T026 [P] [US1] Add tests to `api/tests/timesheet.test.js` for `buildWeeks(month, rows)`: Sep 2026 → 5 weeks, first `start: '2026-08-31'`, last `end: '2026-10-04'`, each with exactly 7 days Monday→Sunday; Aug 2026 → 6 weeks; Feb 2021 → 4 weeks all `spans_other_month: false`; rows `{2026-09-29: '2', 2026-10-02: '3'}` → last week `hours: 5`, `spans_other_month: true`, `days` for 01–04 Oct have `in_month: false`; week `hours` rounded to 2 decimals; every date appears in exactly one week
- [X] T027 [P] [US1] Add a `getTimesheet` test to `api/tests/timesheet.test.js` using the mocked `query` (`vi.mocked(query)` with `mockResolvedValueOnce` for project, entries, sync_state): verify the entries query is called with `[projectId, '2026-08-31', '2026-10-05']` for `'2026-09'`; rows on `2026-08-31` and `2026-10-02` contribute to `weeks` but not to `days` or `total`; `days` still has 30 items

### Implementation for Increment 2

- [X] T028 [US1] In `api/src/services/timesheet.js` add exported pure helpers `weekRange(month)` (Monday on/before the 1st → `from`, Monday after the Sunday on/after the last day → `to`, half-open, UTC arithmetic) and `isoWeek(date)` (ISO 8601 Thursday rule, returns `{ week, year }`); make T025 pass
- [X] T029 [US1] In `api/src/services/timesheet.js` add exported `buildWeeks(month, rows)`: iterate weeks from `weekRange(month).from` in 7-day steps until `to`; each week `{ week, year, start, end, hours, spans_other_month, days }` where `days` are 7 `{ date, weekday, hours, in_month }` (reuse the same row lookup/rounding as `buildMonthDays`; `in_month` = `date.startsWith(month)`), `hours` = round2(sum of the 7 unrounded values), `spans_other_month` = any `!in_month`; make T026 pass
- [X] T030 [US1] Update `getTimesheet` in `api/src/services/timesheet.js`: query with `weekRange(month)` instead of the month bounds; compute `days` via `buildMonthDays(month, rows)` (already ignores out-of-month rows) and `total` from rows whose `date` starts with `month` only; add `weeks: buildWeeks(month, rows)` to the response; update the JSDoc return shape; make T027 pass and run `cd api && npm test` (all green)
- [X] T031 [US1] Update `frontend/src/components/TimesheetModal.jsx` body: render `data.weeks` instead of `data.days`; for each week render its 7 day rows, then a subtotal row. Day rows with `in_month: false`: `opacity: 0.45`, `color: var(--muted)`, no weekend shading, value as plain `<span>` (no copy button, `aria-disabled="true"`). In-month rows keep the existing rendering (muted zeros, weekend shading, click-to-copy). Subtotal row: `background: var(--surface)`, `borderTop: 1px solid var(--border)`, fontSize 11 label `Week {week} · {DD MMM} – {DD MMM}` (`en-GB`, `day: '2-digit', month: 'short'`) with a second muted line "incl. days from other month" when `spans_other_month`, right-aligned bold `formatHours(week.hours, format)` with tabular numerals; not clickable
- [X] T032 [US1] Verify in `frontend/src/components/TimesheetModal.jsx` that Total, `handleCopyMonth`, `handleDownload` and the "Copied N days" notice still use `data.days` / `data.total` only (FR-019, FR-020) and that subtotals use the current `format`; then run `cd frontend && npm run build`

**Checkpoint**: Weekly subtotals work; Copy month / CSV unchanged. Validate quickstart steps 13–17.

---

## Phase 8: Polish (Increment 2)

- [X] T033 [P] Update the "Timesheet" section in `README.md`: add a bullet that rows are grouped by ISO week (Mon–Sun) with a subtotal after each Sunday; edge weeks include greyed days of the neighbouring month and are marked "incl. days from other month"; subtotals are display-only (not in Copy month / CSV)
- [ ] T034 Run `cd api && npm test` and `cd frontend && npm run build`; then validate quickstart steps 1–17 in the Docker stack (`docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build`), including December 2026 (week 53) and light/dark theme

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after US1 (extends `TimesheetModal.jsx` and needs fetched `days`)
- **US3 (Phase 5)**: after US1; independent of US2, but T020 also wires `format` into US2's copy/download calls if US2 is done — if US3 ships before US2, T017/T018 must use `format` when they are implemented
- **Polish (Phase 6)**: after the desired stories
- **Increment 2 (Phase 7)**: depends on Phases 1–5 (already done); T025–T027 → T028 → T029 → T030 (same file chain); T031 needs T030's response shape (can be written in parallel against the contract) → T032
- **Polish Inc. 2 (Phase 8)**: T033 any time after T030; T034 last

### Within User Story 1

- T005, T006 (tests) → T007 → T008 → T009 (API, same file chain)
- T010, T011 parallel to the API chain
- T012 needs T003, T010, T011 → T013 → T014

### Parallel Opportunities

- T001 ‖ T002; T003 ‖ T004
- US1: T005 ‖ T006 ‖ T010 ‖ T011, then the API chain (T007–T009) ‖ frontend chain (T012–T014)
- US2: T015 ‖ T016, then T017 → T018
- US3: T019 ‖ (US2 work) — different functions but same file; coordinate edits
- Polish: T021 ‖ T022
- Increment 2: T025 ‖ T026 ‖ T027 (tests, same file — coordinate or write in one go); T031 ‖ T028–T030 against the contract; T033 ‖ T031

## Parallel Example: User Story 1

```text
Task: "T005 Vitest tests for buildMonthDays/parseMonth in api/tests/timesheet.test.js"
Task: "T006 Route tests for GET /api/projects/:id/timesheet in api/tests/routes.test.js"
Task: "T010 fetchTimesheet in frontend/src/hooks/api.js"
Task: "T011 formatHours (decimal) in frontend/src/utils/timesheet.js"
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 + Phase 2
2. Phase 3 (US1) → **stop and validate**: daily totals correct, overlay reachable from sidebar in both modes
3. Already usable for manual transfer (read values off the list)

### Incremental Delivery

1. US1 → read-only monthly view (MVP)
2. US2 → copy/download removes retyping (largest time saving, SC-001/SC-004)
3. US3 → h:mm format for targets that need it
4. Polish → README, accessibility, full quickstart validation; commit with `feat:` prefix per constitution
5. Increment 2 (Phase 7–8) → weekly subtotals for the weekly transfer routine (SC-006); API first (T025–T030, independently testable via `curl … | jq '.weeks'`), then the modal (T031–T032); commit as `feat: weekly subtotals in timesheet`
