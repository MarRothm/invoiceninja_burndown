# Quickstart: Validate EUR Amounts in the Timesheet

## Run

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
cd api && npm test            # incl. parseRate / amount tests
```

Open the dashboard and click **↻ Sync now**.

## 1. Verify the rate is synced (do this first — R1)

```sql
SELECT id, name, raw->>'task_rate' AS task_rate FROM projects ORDER BY id;
```

Expect a numeric `task_rate` for projects that have a rate in InvoiceNinja and `0`/NULL
otherwise. If the key is missing entirely, stop and revisit research R1.

## 2. API

```bash
curl -s "http://localhost:<API_PORT>/api/projects/1/timesheet?month=2026-09" \
  | jq '{total, rate, amount, weeks: [.weeks[] | {start, hours, amount}]}'
```

- `amount` ≈ `total × rate` (to the cent); `weeks[].amount` ≈ `hours × rate`.
- Project without a rate: `rate`, `amount` and all `weeks[].amount` are `null`.

## 3. UI walkthrough

1. Open the timesheet of a project with a rate → footer shows `@ <rate> €/h` and the EUR amount.
2. Each weekly subtotal shows its EUR amount, including edge weeks.
3. Toggle `1.75 / 1:45` → EUR values unchanged.
4. Switch months → amounts update; a month without bookings shows `0.00 €`.
5. Open a project without a rate → `—` and `No hour rate set`; hours unchanged.
6. **Copy month** and **Download CSV** → still `date, hours` only, no EUR values.
7. Check light/dark themes.
