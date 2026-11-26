# Data Model: Feature 010

There are no database changes.

## API: turnover overview row (additive field)

| Field | Type | Notes |
|-------|------|-------|
| `id`, `name`, `invoiced`, `paid`, `open`, `invoice_count` | unchanged | |
| `billing_mode` | `"hourly"` \| `"lump_sum"` | **new**; from the project's InvoiceNinja tags (`isLumpSum`), same rule as `/api/projects` |

`total` and `years_available` are unchanged.

## Browser state

| Key / state | Values | Default | Scope |
|-------------|--------|---------|-------|
| `localStorage.burndown_show_closed` | `'1'` / `'0'` | off | per browser, survives reload |
| `HeaderMenu` open | boolean | closed | component |
| `TurnoverOverview` year | integer | `initialYear` (declared year, else current year) | component; resets on remount (regeneration, sync) |

## AIDashboard render states (changes only)

| Status | Renders |
|--------|---------|
| `unavailable` | reason message + hint, **then the turnover overview block** (current year, ‹ / ›) |
| `ready` and `showClosed` | generated layout, **then the "Closed projects" section** |
| `ready` and `!showClosed` | generated layout (unchanged) |

## Closed-projects section

- Source: the `projects` list the dashboard already loads (`/api/projects`), filtered to `status === 'closed'`.
- Order: hourly projects by `progress` (descending), then lump-sum projects by `lump_sum.earned_pct` (descending; unset last).
- Blocks per project:
  - hourly: `ProjectCard` and `BurndownChart`;
  - lump sum: `ProjectCard` and `ProjectTurnover`.
- There is never a `TimesheetSummary`.
- No closed projects: "No closed projects."
- Cards of closed projects show a `CLOSED` badge (both the hourly and the lump-sum card).
