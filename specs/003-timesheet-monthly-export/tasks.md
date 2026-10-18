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

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none
- **Foundational (Phase 2)**: after Setup — blocks all stories
- **US1 (Phase 3)**: after Foundational
- **US2 (Phase 4)**: after US1 (extends `TimesheetModal.jsx` and needs fetched `days`)
- **US3 (Phase 5)**: after US1; independent of US2, but T020 also wires `format` into US2's copy/download calls if US2 is done — if US3 ships before US2, T017/T018 must use `format` when they are implemented
- **Polish (Phase 6)**: after the desired stories

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
