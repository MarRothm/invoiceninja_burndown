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
  AND entry_date >= $2::date          -- first day of month
  AND entry_date <  $3::date          -- first day of next month
GROUP BY entry_date
```

Covered by the existing partial index `idx_time_entries_project_date (project_id, entry_date) WHERE status = 'completed'`.

## Derived entities (API response / frontend state)

### Timesheet

| Field | Type | Rules |
|-------|------|-------|
| `project` | `{ id: number, name: string }` | From `projects` |
| `month` | `string` `YYYY-MM` | Echo of validated query param |
| `days` | `DailyTotal[]` | Exactly one per calendar day of `month`, ascending (28–31 items) |
| `total` | `number` | Sum of all completed hours in the month, rounded to 2 decimals |
| `last_synced_at` | `string \| null` | ISO 8601 timestamp of last time-entry sync; `null` if never synced (epoch default) |

### DailyTotal

| Field | Type | Rules |
|-------|------|-------|
| `date` | `string` `YYYY-MM-DD` | Calendar date within `month` |
| `weekday` | `number` 1–7 | ISO weekday (1 = Monday, 6/7 = weekend) |
| `hours` | `number` | Sum for that date, rounded to 2 decimals; `0` if none |

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
