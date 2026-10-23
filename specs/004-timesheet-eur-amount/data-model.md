# Data Model: EUR Equivalent of Timesheet Totals

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-22

No schema change. All values are derived at request time.

## Hour Rate (derived from existing `projects.raw`)

| Field | Source | Type | Rule |
|-------|--------|------|------|
| `rate` | `projects.raw->>'task_rate'` | number \| null | `parseRate`: finite and `> 0` → number, else `null` (R2) |

- One rate per project, current as of the last project sync; no history.
- Currency assumed EUR; no conversion.

## Timesheet (extended, from feature 003)

| Field | Type | Change | Rule |
|-------|------|--------|------|
| `total` | number | unchanged | month hours, rounded to 2 decimals |
| `rate` | number \| null | **new** | see Hour Rate |
| `amount` | number \| null | **new** | `rate === null ? null : round2(unroundedMonthHours × rate)` |

## Weekly Subtotal (extended, from feature 003)

| Field | Type | Change | Rule |
|-------|------|--------|------|
| `hours` | number | unchanged | full Monday–Sunday week incl. neighbouring-month days |
| `amount` | number \| null | **new** | `rate === null ? null : round2(unroundedWeekHours × rate)` |

## Daily Total

Unchanged — no amount per day (spec Assumptions).

## Invariants

- `amount === null` ⇔ `rate === null` (top level and every week).
- `rate !== null && total === 0` ⇒ `amount === 0`.
- `amount` never depends on the hours display format.
- `sum(weeks[].amount)` may differ from `amount` (edge weeks include other-month days; cent rounding).
