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

---

## Increment 2 — Weekly subtotals (2026-10-19)

Inputs: spec Clarifications session 2026-10-19 (full-week subtotals, display-only, greyed
neighbouring-month days), FR-017–FR-020, SC-006.

## R9 — Where weekly subtotals are computed

- **Decision**: In the API service (`buildWeeks` in `api/src/services/timesheet.js`), returned
  as part of the existing timesheet response. The SQL range widens from the month to the full
  weeks touching it: `from` = Monday on/before the 1st, `to` = Monday after the Sunday on/after
  the last day (half-open). Still one grouped query on the existing partial index.
- **Rationale**: Edge-week subtotals need neighbouring-month hours the frontend doesn't have;
  computing in the service keeps aggregation in one layer (Constitution III) and makes it
  unit-testable with Vitest (the frontend has no test runner, R8).
- **Alternatives considered**:
  - Frontend fetches the adjacent months and sums — up to 3 requests per view and summing
    logic in an untested layer.
  - Separate `/timesheet/weeks` endpoint — two requests for one view; no benefit.

## R10 — Response shape (backward compatible)

- **Decision**: Add a `weeks` array; keep `days` (month-only), `total` (month-only) and all
  other fields unchanged. Each week: `{ week, year, start, end, hours, spans_other_month,
  days: [{ date, weekday, hours, in_month }] }`.
- **Rationale**: Purely additive — existing clients and the already-shipped Copy month / CSV
  logic (built on `days`) keep working, which also guarantees FR-019/FR-020 (neighbouring
  days never reach export or total). Nested days avoid recomputing week membership in the UI.
- **Alternatives considered**: Replacing `days` with a 35–42-day `calendar` array plus
  `in_month` — breaking change and forces the export code to filter.

## R11 — Week numbering and boundaries

- **Decision**: Weeks are ISO 8601 (Monday start); `week`/`year` are ISO week number and ISO
  week-year (e.g. Mon 29 Dec 2025 → week 1 of 2026), computed with UTC arithmetic via the
  Thursday rule. A month touches 4–6 weeks (Feb 2021: exactly 4; Aug 2026: 6).
  `spans_other_month = days.some(d => !d.in_month)`; week `hours` = round2(sum of all 7 days).
- **Rationale**: ISO weeks match European timesheet/ERP conventions (German "KW") and the
  spec assumption "weeks start on Monday". UTC avoids DST shifts (same as R1).
- **Alternatives considered**: Locale-dependent week start — ambiguous across target systems.

## R12 — Rendering in the modal

- **Decision**: Iterate `weeks`; per week render its days, then a subtotal row
  ("Week 40 · 28 Sep – 04 Oct", plus "incl. days from other month" when
  `spans_other_month`). Neighbouring-month rows: `opacity: 0.45`, `var(--muted)` text, value
  as plain text (no copy button, `aria-disabled`). Subtotal row: `var(--surface)` background,
  top border, bold value; not clickable (FR-019 display-only). Weekend shading stays for
  in-month rows only.
- **Rationale**: Keeps visual hierarchy (day < week < month) with existing CSS variables only
  (Constitution V); "Week N" makes it easy to match the target system's weekly entry form.
- **Alternatives considered**: Separate week summary table under the list — loses the
  day ↔ week visual connection that makes edge weeks traceable (FR-020).
