# Quickstart: Validate the Monthly Timesheet

## Run

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
cd api && npm test            # unit + route tests incl. timesheet
```

Open the dashboard (default `http://localhost:<FRONTEND_PORT>`), click **↻ Sync now**.

## API checks

```bash
curl -s "http://localhost:<API_PORT>/api/projects/1/timesheet?month=2026-09" | jq '.days | length, .total'
# → 30, <sum>
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:<API_PORT>/api/projects/1/timesheet?month=2026-13"   # → 400
curl -s -o /dev/null -w '%{http_code}\n' "http://localhost:<API_PORT>/api/projects/999999/timesheet?month=2026-09" # → 404
```

Cross-check one day against PostgreSQL:

```sql
SELECT SUM(hours) FROM time_entries
WHERE project_id = 1 AND status = 'completed' AND entry_date = '2026-09-03';
```

## UI walkthrough

1. Click the ▦ icon on a sidebar project card → overlay opens on the current month; the
   selected project in the sidebar does **not** change.
2. Rows = days in month; zero days muted; weekends shaded; total shown; "Last synced" shown.
3. `‹` goes back a month; `›` is disabled on the current month.
4. Toggle `1:45` → all values switch; reload page and reopen → still `1:45`.
5. Click a day value → paste elsewhere → only that value.
6. **Copy month** → paste into a spreadsheet → N rows × 2 columns (SC-004).
7. **Download CSV** → file `timesheet_<slug>_<YYYY-MM>.csv` opens with header + N rows; umlauts intact.
8. Switch to AI dashboard mode → ▦ icon on sidebar cards still opens the timesheet (FR-016).
9. In legacy mode, the "▦ Timesheet" button in the project header opens it for the selected project.
10. Close via ✕, `Esc`, backdrop → dashboard unchanged.
11. Over plain HTTP (non-localhost LAN IP), **Copy month** still works (execCommand fallback).
12. Switch theme (light/dark) → overlay follows theme.
