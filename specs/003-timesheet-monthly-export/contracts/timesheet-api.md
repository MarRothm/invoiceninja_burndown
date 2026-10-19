# Contract: Timesheet API

## `GET /api/projects/:id/timesheet?month=YYYY-MM`

Read-only. Returns the daily totals of completed time entries for one project and one month.

### Parameters

| Name | In | Required | Validation |
|------|----|----------|------------|
| `id` | path | yes | positive integer (existing `parseId`) |
| `month` | query | yes | `^\d{4}-(0[1-9]\|1[0-2])$`, year 2000–2100 |

### 200 OK

```json
{
  "project": { "id": 7, "name": "Website Relaunch" },
  "month": "2026-09",
  "days": [
    { "date": "2026-09-01", "weekday": 2, "hours": 0 },
    { "date": "2026-09-02", "weekday": 3, "hours": 2.5 },
    { "date": "2026-09-03", "weekday": 4, "hours": 4 }
    // … one entry per day, 30 items for September
  ],
  "total": 6.5,
  "last_synced_at": "2026-10-18T07:30:00.000Z",
  "weeks": [
    {
      "week": 36, "year": 2026, "start": "2026-08-31", "end": "2026-09-06",
      "hours": 7.5, "spans_other_month": true,
      "days": [
        { "date": "2026-08-31", "weekday": 1, "hours": 1, "in_month": false },
        { "date": "2026-09-01", "weekday": 2, "hours": 0, "in_month": true }
        // … 7 days, Monday → Sunday
      ]
    }
    // … 5 weeks for September 2026 (weeks 36–40, last one 28 Sep – 04 Oct)
  ]
}
```

### Errors

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project id" }` | `id` not a positive integer |
| 400 | `{ "error": "Invalid month, expected YYYY-MM" }` | `month` missing or malformed |
| 404 | `{ "error": "Project not found" }` | No project with `id` |
| 500 | `{ "error": "Internal server error" }` | Existing global error handler |

`weeks` was added in increment 2 (2026-10-19) and is additive: `days` and `total` keep their
month-only meaning. `weeks[].hours` includes neighbouring-month days, so `sum(weeks[].hours)`
may exceed `total` (spec FR-018).

Future months are **not** rejected (returns zeros); see research R2. Rate limit: global
default (200/min) — no special config.

## Frontend helper (`frontend/src/hooks/api.js`)

```js
export async function fetchTimesheet(projectId, month) // → Timesheet, throws Error('Failed to fetch timesheet')
```
