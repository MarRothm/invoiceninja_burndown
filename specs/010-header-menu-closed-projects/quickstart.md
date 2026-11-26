# Quickstart: Feature 010

## Build and test

```bash
cd api && npm test                    # all green; count = baseline + new turnover billing_mode test(s)
cd ../frontend && npm run build       # must succeed
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Browser checks

1. **Layout**:
   - there is no sidebar;
   - the header shows the title and ☰;
   - the dashboard spans the full width;
   - there is no "€ Turnover" button.
2. **Menu**:
   - ☰ opens Sync now, Show closed projects and Theme;
   - an outside click and Escape close it;
   - Sync now shows progress, closes the menu and refreshes the dashboard;
   - a theme change applies immediately and survives a reload.
3. **Year switching**:
   - in the dashboard's turnover overview, ‹ shows the previous year, with the same figures as `GET /api/turnover?year=<y>`;
   - › is disabled at the current year;
   - the dashboard is not regenerated (no "Generating…").
   - After Sync now, the block shows the current year again.
4. **Lump-sum badge**: a lump-sum project's row shows `LUMP SUM`; hourly rows show none, and the totals are unchanged.
5. **Closed projects**:
   - toggle on: a "Closed projects" section appears below the layout. Each closed project has a card with a `CLOSED` badge and a burndown, or a card and turnover for lump-sum projects. There is no timesheet block.
   - toggle off: the section disappears.
   - The state survives a reload. Switching is instant, with no regeneration.
6. **AI unavailable** (test stack, e.g. `OLLAMA_MODEL=does-not-exist:1b`; do not touch models on the shared macmini host):
   - the reason appears, with the turnover overview (including ‹ / ›) below it, within about 3 s;
   - after restoring, the dashboard replaces both within about 15 s.
7. **Sync error**: stop the API briefly and use Sync now. The error banner appears above the dashboard.
