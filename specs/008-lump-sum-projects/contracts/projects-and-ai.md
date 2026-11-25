# Contract Changes: Lump-Sum Projects

## GET /api/projects — additive

Each item gains two fields. All existing fields keep their meaning and values.

```json
{
  "id": 823,
  "name": "NLW Bonus",
  "status": "in_progress",
  "budgeted_hours": 0, "total_logged": 0, "remaining": 0, "progress": 0,
  "billing_mode": "lump_sum",
  "lump_sum": { "agreed": 10000, "currency": "EUR", "invoiced": 4000, "earned_pct": 40 }
}
```

Hourly project: `"billing_mode": "hourly", "lump_sum": null`.

Other endpoints are unchanged: `/projects/:id/burndown`, `/timesheet`, `/turnover` and `/turnover?year=`. The UI simply does not call burndown or timesheet for lump-sum projects. The turnover totals are unchanged (SC-003).

## AI Dashboard grammar — unchanged components, new rule

- **Project list sent to the model**: each project carries `billing_mode`. Lump-sum projects have `progress: null` and an `earned_pct`. The list is pre-ordered: hourly projects by `progress` descending, then lump-sum projects by `earned_pct` descending.
- **New prompt rule**: for projects with `billing_mode` `"lump_sum"`, never use `BurndownChart` or `TimesheetSummary`. Where the declaration asks for a burndown or timesheet per project, use `ProjectTurnover(projectId)` once instead.
- **Rule 6** now reads: "Keep the order of the project list."
- **Client guarantees**, whatever the model emits:
  - `BurndownChart(n)` for a lump-sum `n` renders the project turnover.
  - `TimesheetSummary(n)` for a lump-sum `n` renders nothing.
  - `ProjectCard(n)` for a lump-sum `n` shows the lump-sum variant.

## AI layout cache key

The key changes from `sha256(declaration)` to `sha256(declaration + "\n" + sorted "id:billing_mode" of in-progress projects)`. `GET /api/ai-dashboard/status` (`cached`) keeps its meaning.
