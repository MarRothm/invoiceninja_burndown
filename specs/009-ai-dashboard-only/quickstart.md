# Quickstart: AI Dashboard as the Only Dashboard

## Build and run

```bash
cd frontend && npm run build          # must succeed
cd ../api && npm test                 # unchanged count, all green
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## Checks (browser)

1. **Fresh browser, and a browser with the old preference**:
   - First run `localStorage.setItem('burndown_dashboard_mode','legacy')` in the devtools, then reload.
   - Both browsers open on the AI Dashboard.
   - `localStorage.getItem('burndown_dashboard_mode')` is now `null`.
2. **Sidebar**: it contains only the title, Sync now, € Turnover and the theme selector. There is no toggle and no project cards.
3. **Timesheet**: click a TimesheetSummary block. The full timesheet opens for that project and month, and copy / CSV work.
4. **€ Turnover**:
   - The overview opens.
   - Clicking a project row shows the AI Dashboard.
   - Clicking € Turnover again also returns to the AI Dashboard.
5. **Sync now**:
   - It works, and the AI Dashboard reloads.
   - Simulate a failure (e.g. stop the API briefly): the error banner is visible in the AI view.
6. **AI unavailable** (on macmini, e.g. `OLLAMA_MODEL=does-not-exist:1b` on a test stack, or with Ollama stopped):
   - The message with the reason appears within about 3 s.
   - € Turnover and Sync now still work.
   - After restoring, the dashboard appears within about 15 s without a reload.
7. **Lump-sum project** (tagged "Pauschalabrechnung", in progress): the AI Dashboard shows the lump-sum card (badge, agreed, invoiced, earned %), then its turnover, and no burndown or timesheet block.
8. **Figures**: the AI Dashboard and € Turnover figures are identical to before the deploy (SC-005).
