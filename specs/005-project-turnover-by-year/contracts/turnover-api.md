# Contract: Turnover API

Read-only. All amounts are gross EUR numbers rounded to 2 decimals; `open = invoiced − paid`.
Counting rules: [research.md](../research.md) R2.

## `GET /api/projects/:id/turnover`

| Name | In | Validation |
|------|----|------------|
| `id` | path | positive integer (existing `parseId`) |

### 200 OK

```json
{
  "project": { "id": 7, "name": "Website Relaunch" },
  "years": [
    { "year": 2026, "invoiced": 2500, "paid": 1500, "open": 1000, "invoice_count": 1 },
    { "year": 2025, "invoiced": 1800, "paid": 1800, "open": 0,    "invoice_count": 2 }
  ],
  "total": { "invoiced": 4300, "paid": 3300, "open": 1000, "invoice_count": 3 },
  "last_synced_at": "2026-11-11T07:30:00.000Z"
}
```

- `years` newest first; `[]` when the project has no counted invoices (`total` all zeros).
- `last_synced_at`: `sync_state` row `invoices`; `null` if never synced.

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid project id" }` | bad `id` |
| 404 | `{ "error": "Project not found" }` | unknown project |

## `GET /api/turnover?year=YYYY`

| Name | In | Validation |
|------|----|------------|
| `year` | query | `^\d{4}$`, 2000–2100 |

### 200 OK

```json
{
  "year": 2026,
  "years_available": [2026, 2025, 2024],
  "projects": [
    { "id": 7, "name": "Website Relaunch", "invoiced": 2500, "paid": 1500, "open": 1000, "invoice_count": 1 }
  ],
  "total": { "invoiced": 2500, "paid": 1500, "open": 1000, "invoice_count": 1 },
  "last_synced_at": "2026-11-11T07:30:00.000Z"
}
```

- `projects`: only visible projects with counted invoices in `year`, sorted by `invoiced` desc, then name.
- `years_available`: distinct years with counted invoices across visible projects, newest first (may not contain `year`).

| Status | Body | When |
|--------|------|------|
| 400 | `{ "error": "Invalid year, expected YYYY" }` | missing/malformed/out of range |

## Frontend helpers (`frontend/src/hooks/api.js`)

```js
export async function fetchProjectTurnover(projectId) // throws Error('Failed to fetch turnover')
export async function fetchTurnover(year)             // throws Error('Failed to fetch turnover')
```

## Sync (`POST /api/sync`)

Response gains `invoices` (count upserted): `{ ok, projects, entries, invoices, ms }`.
