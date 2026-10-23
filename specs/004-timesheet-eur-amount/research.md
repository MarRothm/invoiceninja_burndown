# Phase 0 Research: EUR Equivalent of Timesheet Totals

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-22

No `NEEDS CLARIFICATION` items remained after the 2026-10-22 clarification session. The
decisions below map the spec onto the existing timesheet (feature 003).

## R1 — Source of the hour rate

- **Decision**: Use the InvoiceNinja project field `task_rate`, read from the already
  synchronised `projects.raw` JSONB (`raw->>'task_rate'`) inside the existing
  `getTimesheet` project query.
- **Rationale**: The sync worker stores the full InvoiceNinja project object in `raw` on every
  upsert (`api/src/services/sync.js`), so the rate is already in PostgreSQL — no sync change,
  no migration, no new InvoiceNinja call (Constitution II and III). InvoiceNinja v5 returns
  `task_rate` as a number on the project and `0` when unset.
- **Alternatives considered**:
  - Dedicated `projects.task_rate` column + sync mapping + `init.sql` migration — cleaner
    for ad-hoc SQL, but adds a schema change for a single read path (Constitution V, YAGNI).
  - Fallback to client/company default rate — explicitly excluded by the spec (Assumptions).
- **Verification** (2026-10-23): InvoiceNinja v5 `ProjectTransformer` always emits
  `'task_rate' => (float) $project->task_rate`, so the key is present in `raw` and is `0` when
  unset (consistent with R2). Not yet checked against a live instance (no `.env`/stack in the
  dev environment) — covered by [quickstart.md](quickstart.md) step 1 during T016.

## R2 — "No hour rate" detection

- **Decision**: `parseRate(value)` → `parseFloat(value)`; returns the number when finite and
  `> 0`, otherwise `null`. A `null` rate yields `amount: null` everywhere.
- **Rationale**: Covers missing key, `null`, `""`, `0` and non-numeric values with one rule
  (FR-007, SC-004: never a misleading `0.00 €`).
- **Alternatives considered**: Treat `0` as a valid rate — rejected; InvoiceNinja uses `0` as
  "not set".

## R3 — Where amounts are computed and rounded

- **Decision**: In the API service. `amount = round2(unroundedHours × rate)` for the month
  total and for each week; `buildWeeks` keeps its unrounded sum and receives the rate as an
  optional parameter. No per-day amounts.
- **Rationale**: FR-005 requires unrounded hours as the base; the service already holds the
  unrounded sums (the frontend only receives rounded `hours`). Keeps money logic in one
  testable pure function next to the existing hours aggregation.
- **Alternatives considered**: Compute in the frontend from `rate × total` — would multiply
  rounded hours and break FR-005 for sums of fractional entries.

## R4 — Response shape

- **Decision**: Additive fields only: top-level `rate` (number | null) and `amount`
  (number | null, for `total`), and `weeks[].amount` (number | null). `days`, `total`,
  `weeks[].hours` unchanged.
- **Rationale**: Same additive approach as increment 2 of feature 003; existing clients and
  route tests keep working.

## R5 — Display formatting

- **Decision**: New pure helper `formatEUR(amount)` in `frontend/src/utils/timesheet.js`:
  `amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'`
  → `3,562.50 €`; `null` → `—`. The rate is shown as `@ 95.00 €/h`.
- **Rationale**: Matches the spec example and the existing `en-GB` date formatting in
  `TimesheetModal.jsx`; independent of the hours format toggle (FR-006).
- **Alternatives considered**: `Intl.NumberFormat` with `style: 'currency'` — renders `€3,562.50`
  in `en-GB`, contradicting the spec example; locale-dependent output complicates testing.

## R6 — Copy / CSV

- **Decision**: No change to `toTSV`, `toCSV`, single-value copy or the file name (FR-008).
- **Rationale**: Clarified as display-only; the target systems expect the existing two-column
  hours format.
