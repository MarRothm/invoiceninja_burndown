# Phase 0 Research: Monthly Timesheet

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-18

No `NEEDS CLARIFICATION` items remained in the Technical Context. The decisions below resolve
the design questions that came up while mapping the spec onto the existing codebase.

## R1 — Where daily sums are computed

- **Decision**: New API endpoint `GET /api/projects/:id/timesheet?month=YYYY-MM`, backed by a
  new service `api/src/services/timesheet.js`. One SQL query sums completed `time_entries`
  per `entry_date` for the month; a pure JS function fills every calendar day (zeros included).
- **Rationale**: Mirrors the existing `GET /projects/:id/burndown` pattern and the
  `SUM(hours) … WHERE status = 'completed' GROUP BY entry_date` query already used in
  `getBurndown` (FR-004 parity). Keeps the frontend → API → PostgreSQL layering
  (Constitution III). Day-filling as a pure function is unit-testable without a database.
- **Alternatives considered**:
  - Derive from the existing burndown response (`burndown[].logged`): its date range is
    bounded by first booking/deadline, so months outside that range would be missing, and it
    transfers the whole project history for one month of data.
  - `generate_series` in SQL for day-filling: works, but moves logic out of testable JS.

## R2 — Month validation and "no future months"

- **Decision**: The API validates only the format (`^\d{4}-(0[1-9]|1[0-2])$`, year 2000–2100)
  and returns `400` otherwise. Restricting navigation to ≤ current month (FR-006) is done in
  the frontend using the browser's local date.
- **Rationale**: The server computes "today" in UTC (as `burndown.js` does); the operator's
  browser may already be in the next month (e.g. CET just after midnight on the 1st). A
  server-side future check would produce spurious 400s at month boundaries. Requesting a
  future month is harmless (all zeros).
- **Alternatives considered**: Server-side rejection of future months — rejected for the
  time-zone reason above.

## R3 — Rounding and display formats

- **Decision**: The API returns `hours` per day and `total` as numbers rounded to 2 decimals
  (sum of `NUMERIC(8,2)` values is exact, so no drift). The frontend formats:
  - decimal: `hours.toFixed(2)` → `1.75`
  - hours:minutes: `m = Math.round(hours * 60)` → `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}` → `1:45`
  - month total is formatted from the API `total`, not from summed formatted day values.
- **Rationale**: Satisfies FR-010 and the spec assumption "month total computed from
  unrounded values". Stored hours already have 0.01 h (36 s) precision, so minute rounding is
  the only rounding step in h:mm mode.
- **Alternatives considered**: Returning minutes from the API — adds a second unit to the
  API for a presentation concern.

## R4 — Copy to clipboard on a private-network HTTP origin

- **Decision**: Use `navigator.clipboard.writeText` when `window.isSecureContext`; otherwise
  fall back to a hidden `<textarea>` + `document.execCommand('copy')`. If both fail, show an
  inline message pointing to the Download button (spec edge case).
- **Rationale**: The stack is typically reached via plain HTTP on a LAN (Constitution I),
  where the async Clipboard API is unavailable. `execCommand('copy')` is deprecated but still
  supported by Chrome, Firefox and Safari inside a user gesture.
- **Alternatives considered**: Clipboard API only — would fail on the most common deployment.

## R5 — Clipboard and file formats

- **Decision**:
  - Clipboard (whole month): tab-separated, no header, one line per day: `YYYY-MM-DD\t<hours>`
    — pastes as two columns in Excel, LibreOffice and Google Sheets regardless of locale list
    separator.
  - Clipboard (single day): the formatted value only.
  - Download: CSV (RFC 4180), comma-separated, header `date,hours`, one row per day, `\r\n`
    line endings, UTF-8 with BOM, filename `timesheet_<project-slug>_<YYYY-MM>.csv`.
  - Decimal separator is always `.`; operators whose target expects `,` can use h:mm mode.
- **Rationale**: Tab is the de-facto spreadsheet paste format (SC-004). BOM makes Excel
  detect UTF-8 for project names with umlauts. A fixed `.` keeps the export unambiguous.
- **Alternatives considered**: Semicolon CSV for European Excel — locale-dependent; could
  be added later as an option if needed (YAGNI).

## R6 — Placement of the timesheet action (Option C)

- **Decision**:
  - Sidebar `ProjectCard`: root element changes from `<button>` to
    `<div role="button" tabIndex={0}>` with Enter/Space handling, so a nested
    `<button>` timesheet icon (`▦`, `title="Timesheet"`) is valid HTML. The icon calls
    `onOpenTimesheet` with `stopPropagation()` so it doesn't also select the project.
  - Legacy project header: a "Timesheet" button next to the `<h1>`.
  - The overlay (`TimesheetModal`) is rendered once in `App.jsx`, outside the legacy/AI mode
    branches, driven by `timesheetProject` state.
- **Rationale**: The sidebar is shown in both legacy and AI mode, so the sidebar icon alone
  satisfies FR-016 without touching openUI-registered AI components (which are constrained
  by feature 002's FR-004). Nested interactive elements inside `<button>` are invalid HTML.
- **Alternatives considered**: Adding the action to `ProjectCard.ai.jsx` — needs a new
  callback in `AIDashboardContext` and duplicates the sidebar entry point; not needed.

## R7 — Last-sync time (FR-012)

- **Decision**: Read `sync_state.last_synced_at` for resource `time_entries` and return it
  as `last_synced_at` (ISO string or `null`) in the timesheet response.
- **Rationale**: The cursor is already maintained by `sync.js`; no schema change.
- **Alternatives considered**: `MAX(time_entries.synced_at)` — misses syncs that changed nothing.

## R8 — Frontend tests

- **Decision**: No frontend test runner is added. Formatting/export logic lives in a pure
  module `frontend/src/utils/timesheet.js`; behaviour is verified via [quickstart.md](quickstart.md)
  in the Docker stack. API logic is covered with Vitest under `api/tests/`.
- **Rationale**: The frontend currently has no test setup; adding one is out of scope (YAGNI,
  Constitution V). Constitution testing policy targets `api/tests/`.
- **Alternatives considered**: Add Vitest + RTL to the frontend — reasonable later, but a
  separate tooling change.
