# API Contract Change: Turnover Overview

## `GET /api/turnover?year=YYYY`

The response is unchanged, except for one **additive** field per entry in `projects[]`:

```json
{
  "year": 2026,
  "years_available": [2026, 2025],
  "projects": [
    { "id": 7, "name": "Website", "invoiced": 12000, "paid": 8000, "open": 4000, "invoice_count": 3, "billing_mode": "lump_sum" },
    { "id": 3, "name": "Support", "invoiced": 5000,  "paid": 5000, "open": 0,    "invoice_count": 5, "billing_mode": "hourly" }
  ],
  "total": { "invoiced": 17000, "paid": 13000, "open": 4000, "invoice_count": 8 },
  "last_synced_at": "2026-11-26T08:00:00.000Z"
}
```

- `billing_mode` follows the same rule as `/api/projects`: the tag "Pauschalabrechnung" (case-insensitive, trimmed) means `"lump_sum"`, everything else `"hourly"`.
- Rows, their order, the amounts, `total` and `years_available` MUST be unchanged (SC-005). The billing mode never filters.

All other endpoints, including `/api/ai-dashboard` and its prompt and cache, are unchanged.
