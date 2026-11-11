# Data Model: Project Turnover by Year

**Feature**: [spec.md](spec.md) | **Date**: 2026-11-11

## `invoices` (new table)

| Column | Type | Source (InvoiceNinja invoice) | Notes |
|--------|------|-------------------------------|-------|
| `id` | SERIAL PK | — | |
| `invoiceninja_id` | VARCHAR(50) UNIQUE NOT NULL | `id` | upsert key |
| `project_id` | INT NULL → `projects(id)` ON DELETE SET NULL | `project_id` via `projects.invoiceninja_id` | NULL = not linked (never counted) |
| `number` | VARCHAR(100) | `number` | display/debug only |
| `invoice_date` | DATE NULL | `date` (`''` → NULL) | year attribution (FR-002); NULL never counted |
| `amount` | NUMERIC(12,2) NOT NULL DEFAULT 0 | `amount` | gross (FR-003) |
| `paid_to_date` | NUMERIC(12,2) NOT NULL DEFAULT 0 | `paid_to_date` | net of refunds (R1) |
| `status_id` | SMALLINT NOT NULL | `status_id` (string → int) | 1 draft … 6 reversed |
| `is_deleted` | BOOLEAN NOT NULL DEFAULT false | `is_deleted` | |
| `raw` | JSONB | full object | same pattern as `projects.raw` |
| `synced_at`, `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT NOW() | — | |

Index: `idx_invoices_project_date ON invoices (project_id, invoice_date) WHERE NOT is_deleted AND status_id IN (2, 3, 4)`.

`sync_state`: new row `('invoices')`.

## Counted invoice (filter, R2)

`project_id IS NOT NULL AND invoice_date IS NOT NULL AND NOT is_deleted AND status_id IN (2, 3, 4)`,
joined to visible projects (`NOT (raw->>'is_deleted')::boolean AND archived_at IS NULL`).

## Yearly Turnover (derived, not stored)

| Field | Rule |
|-------|------|
| `year` | `EXTRACT(YEAR FROM invoice_date)` |
| `invoiced` | `round2(Σ amount)` |
| `paid` | `round2(Σ paid_to_date)` |
| `open` | `round2(invoiced − paid)` |
| `invoice_count` | count of counted invoices |

## Invariants

- `invoiced = paid + open` for every row and every total (to the cent).
- Per-project table and overview use the same filter, so a project+year value is identical in both (FR-014).
- Overview `total` = Σ listed projects (SC-005); per-project `total` = Σ its years.
- Projects without counted invoices: per-project `years: []` ("No invoices yet", FR-007); absent from the overview (FR-012).

## Sync state transitions (per invoice)

New/changed in InvoiceNinja → upsert on next sync (status, amounts, project link, deletion all overwritten). Nothing is ever deleted locally; `is_deleted = true` excludes the invoice from counting.
