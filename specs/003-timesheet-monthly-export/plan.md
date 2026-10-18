# Implementation Plan: Monthly Timesheet for Transfer to External Systems

**Branch**: `003-timesheet-monthly-export` | **Date**: 2026-10-18 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/003-timesheet-monthly-export/spec.md`

## Summary

Add a read-only monthly timesheet per project: one row per calendar day with the sum of
completed booked hours, a month total, copy-to-clipboard (whole month as TSV or a single
value), CSV download, and a decimal ↔ h:mm toggle. A new endpoint
`GET /api/projects/:id/timesheet?month=YYYY-MM` returns the filled-in month from existing
`time_entries`; the frontend opens it in an overlay from a ▦ icon on every sidebar project
card (available in legacy and AI mode) and from a button in the legacy project header
(GUI Option C). No schema change, no new dependencies, no new services.

## Technical Context

**Language/Version**: JavaScript (ESM) — Node.js 22 (API), React 18 (frontend)

**Primary Dependencies**: Existing only — Fastify 5, `pg`, React 18, Vite 5. No additions.

**Storage**: PostgreSQL — read-only use of `projects`, `time_entries`, `sync_state`; no migration

**Testing**: Vitest (`api/tests/`) for service and route; manual UI validation per [quickstart.md](quickstart.md)

**Target Platform**: Docker Compose stack; desktop browsers (Chrome, Firefox, Safari), often over plain HTTP on a LAN

**Project Type**: Enhancement of existing web application (API + SPA)

**Performance Goals**: Timesheet visible ≤ 2 s after open / month switch (SC-003) — single indexed aggregate query, ≤ 31 rows

**Constraints**:
- Read-only; InvoiceNinja remains the source of truth (FR-013, Constitution II)
- Frontend talks only to the API (Constitution III)
- Clipboard must work on non-secure (HTTP) origins → fallback (research R4)
- Styling only via existing CSS variables / design tokens (FR-014, Constitution V)
- AI-dashboard openUI components stay unchanged (sidebar entry point covers AI mode)

**Scale/Scope**: 1 API route, 1 service, 1 modal component, 1 utility module, small edits to `ProjectCard.jsx`, `App.jsx`, `api.js`, `README.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | New endpoint is read-only, same trust boundary as existing `/projects/*`; no auth added |
| II. InvoiceNinja Single Source of Truth | ✅ Pass | Reads synced `time_entries` only; no writes; same `status = 'completed'` rule as burndown |
| III. Layered Service Architecture | ✅ Pass | Frontend → `GET /api/projects/:id/timesheet` → service → PostgreSQL; aggregation in API service |
| IV. Security Hygiene | ✅ Pass | No new dependencies; strict input validation (`parseId`, month regex); CSV built client-side from numbers/ISO dates only (no formula injection surface — project name only in filename, slugified) |
| V. Simplicity & Observable Configuration | ✅ Pass | No env vars, no new services, no frontend test tooling (R8); only existing CSS variables; `README.md` updated with endpoint + feature |

**Post-design re-check (after Phase 1)**: ✅ All pass — design artifacts introduce no schema
change, dependency, configuration, or cross-layer call.

## Project Structure

### Documentation (this feature)

```text
specs/003-timesheet-monthly-export/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── timesheet-api.md # REST contract
│   └── timesheet-ui.md  # Overlay / interaction contract
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
api/
├── src/
│   ├── routes/
│   │   └── projects.js          # Updated: add GET /projects/:id/timesheet (month validation)
│   └── services/
│       └── timesheet.js         # New: getTimesheet(projectId, month), buildMonthDays() (pure)
└── tests/
    ├── timesheet.test.js        # New: buildMonthDays (28/29/30/31 days, zeros, weekday, rounding)
    └── routes.test.js           # Updated: timesheet route 200 / 400 / 404

frontend/
└── src/
    ├── App.jsx                  # Updated: timesheetProject state, header button, render <TimesheetModal>
    ├── components/
    │   ├── ProjectCard.jsx      # Updated: root <div role="button">, ▦ icon → onOpenTimesheet
    │   └── TimesheetModal.jsx   # New: overlay, month nav, format toggle, rows, copy/download
    ├── hooks/
    │   └── api.js               # Updated: fetchTimesheet(projectId, month)
    └── utils/
        └── timesheet.js         # New: formatHours, toTSV, toCSV, fileName, shiftMonth, currentMonth, copyText

README.md                        # Updated: endpoint table + Timesheet feature section
```

**Structure Decision**: Additive change to the existing `api/` + `frontend/` web application.
The API follows the `routes/projects.js` → `services/*.js` pattern used by burndown; the
frontend adds one component next to the legacy components and keeps all AI-dashboard files
under `frontend/src/components/ai/` untouched.

## Design Notes

- **Endpoint & payload**: see [contracts/timesheet-api.md](contracts/timesheet-api.md).
- **Daily aggregation**: single grouped query for `[first day, first day of next month)`;
  `buildMonthDays(month, rows)` produces exactly one `{ date, weekday, hours }` per day.
  Dates are built from `YYYY-MM-DD` strings with UTC arithmetic to avoid DST/time-zone shifts.
- **Overlay**: see [contracts/timesheet-ui.md](contracts/timesheet-ui.md). Rendered once in
  `App.jsx` outside the legacy/AI branch so it works in both modes and leaves the dashboard
  state untouched when closed.
- **Copy/Download**: client-side from the fetched `days` using the current format;
  clipboard fallback for HTTP origins (R4); TSV for paste, CSV with BOM for download (R5).

## Complexity Tracking

No constitution violations — section intentionally empty.
