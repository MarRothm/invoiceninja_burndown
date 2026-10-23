# Implementation Plan: EUR Equivalent of Timesheet Totals

**Branch**: `004-timesheet-eur-amount` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/004-timesheet-eur-amount/spec.md`

## Summary

Show the EUR value of the timesheet's month total and of every weekly subtotal, based on the
project's InvoiceNinja task rate. The existing endpoint
`GET /api/projects/:id/timesheet?month=YYYY-MM` gains additive fields `rate`, `amount` and
`weeks[].amount`, computed in `api/src/services/timesheet.js` from unrounded hours. The rate is
read from the already-synced `projects.raw` JSONB — no sync change, no migration, no new
dependency. `TimesheetModal.jsx` renders the amounts (display-only); Copy month and CSV are
unchanged. Projects without a rate show `—` and "No hour rate set".

## Technical Context

**Language/Version**: JavaScript (ESM) — Node.js 22 (API), React 18 (frontend)

**Primary Dependencies**: Existing only — Fastify 5, `pg`, React 18, Vite 5. No additions.

**Storage**: PostgreSQL — read-only use of `projects.raw->>'task_rate'`; no migration (research R1)

**Testing**: Vitest (`api/tests/`) for `parseRate`, amount calculation and route; manual UI validation per [quickstart.md](quickstart.md)

**Target Platform**: Docker Compose stack; desktop browsers

**Project Type**: Enhancement of existing web application (API + SPA)

**Performance Goals**: Unchanged ≤ 2 s timesheet load (SC-003) — one extra JSONB field in an existing primary-key query

**Constraints**:
- Rate only from InvoiceNinja, no manual entry/override (FR-002, Constitution II)
- Amounts from unrounded hours, rounded to cents (FR-005, R3)
- Display-only: `toTSV`, `toCSV`, single-value copy untouched (FR-008)
- Response change additive only (R4)
- Styling via existing CSS variables (FR-010, Constitution V)

**Scale/Scope**: Edits to `api/src/services/timesheet.js`, `api/tests/timesheet.test.js`, `api/tests/routes.test.js`, `frontend/src/utils/timesheet.js`, `frontend/src/components/TimesheetModal.jsx`, `README.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | Existing read-only endpoint; no new surface |
| II. InvoiceNinja Single Source of Truth | ✅ Pass | Rate comes from InvoiceNinja `task_rate` via sync; no manual entry (clarified) |
| III. Layered Service Architecture | ✅ Pass | Calculation in API service; frontend only formats; no direct InvoiceNinja call from API |
| IV. Security Hygiene | ✅ Pass | No new dependencies; rate parsed defensively (`parseRate`) |
| V. Simplicity & Observable Configuration | ✅ Pass | No env vars, no schema change, existing design tokens; `README.md` Timesheet section updated |

**Post-design re-check (after Phase 1)**: ✅ All pass — artifacts add three nullable response
fields and one formatting helper; no schema, dependency, configuration or layering change.

## Project Structure

### Documentation (this feature)

```text
specs/004-timesheet-eur-amount/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── timesheet-api.md # Response delta (rate, amount, weeks[].amount)
│   └── timesheet-ui.md  # Footer / weekly subtotal delta
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
api/
├── src/services/
│   └── timesheet.js         # Updated: parseRate(), amountFor() (pure); buildWeeks(month, rows, rate)
│                            #   adds weeks[].amount; getTimesheet selects raw->>'task_rate',
│                            #   returns rate + amount
└── tests/
    ├── timesheet.test.js    # Updated: parseRate (number, string, 0, null, garbage), amount rounding
    │                        #   from unrounded hours, null propagation, edge-week amounts
    └── routes.test.js       # Updated: mocked payload with rate/amount passes through

frontend/src/
├── utils/
│   └── timesheet.js         # Updated: formatEUR(amount), formatRate(rate)
└── components/
    └── TimesheetModal.jsx   # Updated: EUR line in footer total, EUR under weekly subtotals,
                             #   "No hour rate set" hint

README.md                    # Updated: Timesheet section mentions EUR amounts and task rate source
```

**Structure Decision**: Additive change inside the feature-003 timesheet files; no new
modules. API endpoint table in `README.md` is unchanged (same route).

## Design Notes

- **Rate source**: `SELECT id, name, raw->>'task_rate' AS task_rate FROM projects WHERE id = $1`
  → `parseRate` (R1, R2). Verify the key on a live instance first ([quickstart.md](quickstart.md) step 1).
- **Calculation**: `amountFor(hours, rate) = rate === null ? null : round2(hours * rate)`, applied
  to the unrounded month sum and to `buildWeeks`' unrounded week sums (R3).
- **Payload**: see [contracts/timesheet-api.md](contracts/timesheet-api.md).
- **UI**: see [contracts/timesheet-ui.md](contracts/timesheet-ui.md); `formatEUR` independent of
  the hours format toggle (R5).

## Complexity Tracking

No constitution violations — section intentionally empty.
