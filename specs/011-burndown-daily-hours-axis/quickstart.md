# Quickstart: Own Fixed Scale for Daily Hours in the Burndown

## Build

```bash
cd frontend && npm run build
cd ../api && npm test          # unchanged suite, must stay green
docker compose build frontend
```

## Browser checks

1. **Fixed scale (US1)**:
   - Open the AI Dashboard. Every burndown has a right-hand axis labelled `0h`, `5h` and `10h`.
   - A 10 h tick sits about one third of the way up the plot.
2. **Same height across budgets (SC-001, SC-002)**:
   - Compare a small-budget and a large-budget (≥ 500 h) project. Bars of equal hours have equal height.
   - A 1 h day is clearly visible on the large project.
3. **Lines unchanged (FR-006)**:
   - Ideal, actual and forecast, the left axis values, and the "Today" marker match the previous version.
   - The bars do not cover the lines in the upper two thirds.
4. **Overflow (US2)**:
   - A day with more than 10 h shows a capped bar with ▲, and its tooltip shows the real hours.
   - Days with 10 h or less have no ▲.
   - If no such day exists, temporarily book one in InvoiceNinja and sync, or check with a project that has one.
5. **Closed projects (FR-007)**: turn on "Show closed projects". Their burndowns use the same daily scale.
6. **Themes**: switch every theme. The axis labels and ▲ stay readable.
7. **Narrow window**: shrink to about 400 px. Both axes stay legible.
