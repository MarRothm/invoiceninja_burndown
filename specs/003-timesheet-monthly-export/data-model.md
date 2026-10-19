# Data Model: Monthly Timesheet

**Feature**: [spec.md](spec.md) | **Date**: 2026-10-18

No database schema changes. The timesheet is a read-only projection of existing tables.

## Source tables (existing, unchanged — `init.sql`)

| Table | Columns used | Notes |
|-------|--------------|-------|
| `projects` | `id`, `name` | Lookup only; 404 if `id` does not exist |
| `time_entries` | `project_id`, `entry_date`, `hours`, `status` | Only `status = 'completed'` counts (same rule as burndown) |
| `sync_state` | `resource = 'time_entries'`, `last_synced_at` | Shown as "last synced" |

Query (per request):

```sql
SELECT entry_date::text AS date, SUM(hours) AS hours
FROM time_entries
WHERE project_id = $1
  AND status = 'completed'
  AND entry_date >= $2::date          -- Monday on/before the 1st of the month (increment 2)
  AND entry_date <  $3::date          -- Monday after the week containing the last day
GROUP BY entry_date
```

In-month rows feed `days`/`total`; all rows feed `weeks` (increment 2). Covered by the existing partial index `idx_time_entries_project_date (project_id, entry_date) WHERE status = 'completed'`.

## Derived entities (API response / frontend state)

### Timesheet

| Field | Type | Rules |
|-------|------|-------|
| `project` | `{ id: number, name: string }` | From `projects` |
| `month` | `string` `YYYY-MM` | Echo of validated query param |
| `days` | `DailyTotal[]` | Exactly one per calendar day of `month`, ascending (28–31 items) |
| `total` | `number` | Sum of all completed hours in the month, rounded to 2 decimals (in-month days only) |
| `weeks` | `WeeklySubtotal[]` | Inc. 2 — every Monday–Sunday week touching `month`, ascending (4–6 items) |
| `last_synced_at` | `string \| null` | ISO 8601 timestamp of last time-entry sync; `null` if never synced (epoch default) |

### DailyTotal

| Field | Type | Rules |
|-------|------|-------|
| `date` | `string` `YYYY-MM-DD` | Calendar date within `month` |
| `weekday` | `number` 1–7 | ISO weekday (1 = Monday, 6/7 = weekend) |
| `hours` | `number` | Sum for that date, rounded to 2 decimals; `0` if none |

### WeeklySubtotal (increment 2)

| Field | Type | Rules |
|-------|------|-------|
| `week` | `number` 1–53 | ISO 8601 week number |
| `year` | `number` | ISO week-year (may differ from calendar year at year end) |
| `start` | `string` `YYYY-MM-DD` | Monday |
| `end` | `string` `YYYY-MM-DD` | Sunday |
| `hours` | `number` | round2(sum of all 7 days incl. neighbouring-month days) |
| `spans_other_month` | `boolean` | `true` if any day has `in_month: false` → UI label "incl. days from other month" |
| `days` | `WeekDay[7]` | Monday → Sunday |

`WeekDay` = `DailyTotal` + `in_month: boolean`. Days with `in_month: false` are display-only
(greyed, not copyable) and never part of `days`, `total`, Copy month or CSV (FR-019, FR-020).

Invariants: every in-month `WeekDay` equals the matching entry in `days`; each date appears in
exactly one week; `weeks[0].start <= month-01` and `weeks.at(-1).end >= last day`.

Invariant: `round2(sum(days[].hours)) === total` (holds because stored hours have 2 decimals).

### TimesheetFormat (frontend preference)

| Value | Display / export of 1.75 h |
|-------|----------------------------|
| `decimal` (default) | `1.75` |
| `hhmm` | `1:45` |

Persisted in `localStorage` key `burndown_timesheet_format` (same pattern as `burndown_dashboard_mode`).

### Overlay state (frontend, `App.jsx`)

| State | Type | Transitions |
|-------|------|-------------|
| `timesheetProject` | `project \| null` | `null` → project (timesheet icon/button) → `null` (close, Esc, backdrop) |
| `month` (inside modal) | `YYYY-MM` | init = current local month; prev ↔ next, next disabled at current month |
| load status (inside modal) | `loading \| ready \| error` | refetch on month change; error shows retry |
