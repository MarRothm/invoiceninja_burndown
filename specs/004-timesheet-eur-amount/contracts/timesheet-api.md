# Contract Delta: Timesheet API

Extends [003 timesheet-api.md](../../003-timesheet-monthly-export/contracts/timesheet-api.md).
Endpoint, parameters and errors are unchanged.

## `GET /api/projects/:id/timesheet?month=YYYY-MM` — 200 OK (additive fields)

```json
{
  "project": { "id": 7, "name": "Website Relaunch" },
  "month": "2026-09",
  "days": [ /* unchanged */ ],
  "total": 37.5,
  "rate": 95,
  "amount": 3562.5,
  "last_synced_at": "2026-10-18T07:30:00.000Z",
  "weeks": [
    {
      "week": 36, "year": 2026, "start": "2026-08-31", "end": "2026-09-06",
      "hours": 7.5, "amount": 712.5, "spans_other_month": true,
      "days": [ /* unchanged */ ]
    }
  ]
}
```

| Field | Type | Meaning |
|-------|------|---------|
| `rate` | number \| null | Project hour rate in EUR (InvoiceNinja `task_rate`); `null` if missing or ≤ 0 |
| `amount` | number \| null | `total` in EUR, from unrounded hours, rounded to cents; `null` iff `rate` is `null` |
| `weeks[].amount` | number \| null | Week `hours` in EUR (full Mon–Sun week); `null` iff `rate` is `null` |

Clients that ignore the new fields behave exactly as before.
