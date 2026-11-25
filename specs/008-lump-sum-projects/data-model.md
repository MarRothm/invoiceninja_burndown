# Data Model: Lump-Sum Projects

No schema change. All new values are derived at read time from `projects.raw` (InvoiceNinja project JSON) and `invoices`.

## Project (extended view model)

Returned by `listProjectsWithStats()` / `GET /api/projects`; existing fields unchanged.

| Field | Type | Source / rule |
|-------|------|---------------|
| `billing_mode` | `"hourly" \| "lump_sum"` | `lump_sum` iff any `raw.tags[].name`, trimmed and lower-cased, equals `pauschalabrechnung` |
| `lump_sum` | object \| `null` | `null` for hourly projects |
| `lump_sum.agreed` | number \| `null` | `parseAmount(raw.custom_value3)` (R4); `null` = not set |
| `lump_sum.currency` | string | `raw.custom_value4` trimmed, upper-cased; `"EUR"` if empty |
| `lump_sum.invoiced` | number | sum of counted invoices' `amount`, all years (R3), rounded to cents |
| `lump_sum.earned_pct` | integer \| `null` | `round(invoiced / agreed × 100)`; `null` if `agreed` is `null` |

Hourly fields (`budgeted_hours`, `total_logged`, `remaining`, `progress`) are still computed for lump-sum projects (backward compatibility), but no view displays them for `lump_sum`.

## Validation rules

- The tag match ignores case and surrounding whitespace. Other tags are ignored. A missing or non-array `tags` means hourly.
- `agreed` must be finite and > 0, otherwise `null`.
- `custom_value2` (actual end date) and the status rule are unchanged for both modes.

## State transitions

`hourly ⇄ lump_sum`: when the tag is added or removed in InvoiceNinja, the project's `updated_at` is bumped. The next incremental sync stores the new `raw`, and the next read reflects the new mode (FR-002, SC-004). An AI layout cached for the old mode is not reused (R8).
