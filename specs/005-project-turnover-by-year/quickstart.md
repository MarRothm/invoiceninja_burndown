# Quickstart: Validate Project Turnover by Year

## Run

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
cd api && npm test
```

Open the dashboard and click **↻ Sync now** (response includes `invoices`).

## 1. Schema and sync (existing volume!)

Run against a database that existed **before** this feature to verify the startup migration (R5):

```sql
\d invoices
SELECT resource, last_synced_at FROM sync_state;          -- includes 'invoices'
SELECT status_id, is_deleted, count(*) FROM invoices GROUP BY 1, 2 ORDER BY 1, 2;
```

In InvoiceNinja archive one invoice and delete another, sync again: the archived one stays
counted, the deleted one gets `is_deleted = true` (R3).

## 2. API

```bash
curl -s "http://localhost:<API_PORT>/api/projects/1/turnover" | jq
curl -s "http://localhost:<API_PORT>/api/turnover?year=2026" | jq '.total, .years_available'
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:<API_PORT>/api/turnover?year=26"   # → 400
```

Cross-check one project/year in InvoiceNinja (Invoices list filtered by project and date range,
excluding drafts/cancelled/reversed): invoiced = Σ amount, paid = Σ paid to date.

```sql
SELECT EXTRACT(YEAR FROM invoice_date) y, SUM(amount), SUM(paid_to_date)
FROM invoices WHERE project_id = 1 AND NOT is_deleted AND status_id IN (2,3,4)
GROUP BY 1 ORDER BY 1 DESC;
```

## 3. UI walkthrough

1. Select a project with invoices in two years → table newest first, total row, paid + open = invoiced.
2. Invoice from December paid in January → counted as paid in the invoice year.
3. Project without invoices → "No invoices yet".
4. Click **€ Turnover** (also in AI mode) → overview for the current year, sorted by invoiced, total row.
5. Switch years with ‹ / › → only projects with invoices in that year.
6. Click a project row → its detail view opens (legacy mode) with matching numbers.
7. Record a payment in InvoiceNinja, **↻ Sync now** → paid/open update in both views.
8. Check light/dark themes.
