# Contract: Turnover UI

Amounts via `formatEUR` (feature 004): `3,562.50 €`. Styling only via existing CSS variables.

## Per-project table (legacy project detail view)

Section "Turnover" below the burndown chart:

| Year | Invoiced | Paid | Open |
|------|---------:|-----:|-----:|
| 2026 | 2,500.00 € | 1,500.00 € | 1,000.00 € |
| 2025 | 1,800.00 € | 1,800.00 € | 0.00 € |
| **Total** | **4,300.00 €** | **3,300.00 €** | **1,000.00 €** |

- Newest year first; total row bold. `Open > 0` in `var(--accent2)`, `0.00 €` muted.
- No counted invoices → "No invoices yet" (muted), no table.
- Footer line: `Gross amounts incl. VAT · Last synced: <date time | never>`.
- Loading → "Loading..."; error → message + Retry (same pattern as `TimesheetModal`).
- Reloads when the selected project changes and after **↻ Sync now**.

## Sidebar entry

- `€ Turnover` button directly below **↻ Sync now**, same button style; available in legacy and AI mode.
- Active state (accent border) while the overview is shown; clicking again returns to the dashboard.

## Cross-project overview (main area)

- Header: "Turnover" + year selector `‹ 2026 ›` (default current year; ‹/› step through `years_available`, plus the current year).
- Table: Project | Invoiced | Paid | Open, sorted by invoiced desc, total row at the bottom.
- No projects for the year → "No invoices in <year>".
- Row click → select project, close overview, switch to legacy mode if in AI mode, show its detail view.
- Same footer line as the per-project table.
