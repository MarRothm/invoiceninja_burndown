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
  "last_synced_at": "2026-10-18T07:30:00.000Z"
}
```

### Errors

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project id" }` | `id` not a positive integer |
| 400 | `{ "error": "Invalid month, expected YYYY-MM" }` | `month` missing or malformed |
| 404 | `{ "error": "Project not found" }` | No project with `id` |
| 500 | `{ "error": "Internal server error" }` | Existing global error handler |

Future months are **not** rejected (returns zeros); see research R2. Rate limit: global
default (200/min) — no special config.

## Frontend helper (`frontend/src/hooks/api.js`)

```js
export async function fetchTimesheet(projectId, month) // → Timesheet, throws Error('Failed to fetch timesheet')
```
