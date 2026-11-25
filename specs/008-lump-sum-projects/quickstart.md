# Quickstart: Lump-Sum Projects

## Prerequisites in InvoiceNinja

1. Settings → Tags ("Stichworte"): the tag **Pauschalabrechnung**, type *Project*, exists.
2. Settings → Custom fields → Projects:
   - field 3 is labelled **Vereinbarte Pauschale**;
   - field 4 is labelled **Projektwährung**.
3. On a test project (e.g. "NLW Bonus"):
   - assign the tag;
   - set field 3 = `10.000,00`;
   - leave field 4 empty (EUR), or set `CHF`.

## Verify tags reach the database (do this first)

After a sync, run:

```bash
docker compose exec postgres psql -U burndown -d burndown -c \
  "SELECT id, name, raw->'tags' AS tags, raw->>'custom_value3' AS cv3, raw->>'custom_value4' AS cv4 FROM projects WHERE raw->'tags' <> '[]'::jsonb;"
```

The query must list the test project with `[{"name":"Pauschalabrechnung",...}]`.

If `tags` is missing entirely, the InvoiceNinja version predates tags. Stop and report.

If the project was tagged before its last sync but shows no tags, force a full project resync:

```sql
UPDATE sync_state SET last_synced_at = 'epoch' WHERE resource = 'projects';
```

Then run `curl -X POST :6088/api/sync`.

## Checks

1. **API**: `curl -s localhost:6088/api/projects | jq '.data[] | {name, billing_mode, lump_sum}'` shows:
   - for the test project, `lump_sum` with `agreed` 10000 and `earned_pct` = round(invoiced / 10000 × 100);
   - for every other project, `hourly` and `null`.
2. **Classic dashboard**:
   - The test card shows a "LUMP SUM" marker, "10,000.00 €" and the earned %.
   - It shows no hours and no timesheet icon.
3. **Project detail** (test project):
   - It shows a lump-sum stats row and the turnover table.
   - It shows no burndown, no hour stats and no Timesheet button.
4. **Turnover overview**: the yearly totals equal the values before the change (SC-003).
5. **AI Dashboard** (default declaration):
   - The test project shows its lump-sum card followed by its turnover.
   - It gets no burndown and no timesheet block.
   - Hourly projects are unchanged.
6. **Mode change**:
   - Remove the tag in InvoiceNinja and run `POST /api/sync`.
   - The project is shown as hourly everywhere, including a freshly generated AI Dashboard.
7. **Edge values**:
   - Field 3 empty → "Lump sum not set".
   - Field 4 `CHF` → "CHF 10,000.00".
   - Field 4 `XYZ` → "XYZ 10,000.00" (any well-formed 3-letter code is shown as entered; only a malformed code falls back to "10,000.00 <code>").
