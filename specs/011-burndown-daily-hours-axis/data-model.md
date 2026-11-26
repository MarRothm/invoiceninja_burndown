# Data Model: Own Fixed Scale for Daily Hours in the Burndown

No storage or API change. `/api/projects/:id/burndown` still returns `burndown: [{ date, ideal, actual, forecast?, logged }]`.

## Derived chart point (frontend only)

| Field | Source | Rule |
|-------|--------|------|
| `logged` | API | real booked hours that day (unchanged; used by the tooltip) |
| `daily` | derived | `min(logged, 10)`, plotted on the daily axis |
| `over` | derived | `logged > 10`, drives the ▲ marker |

## Daily scale

- Range: labelled ticks 0 h, 5 h and 10 h.
- Axis domain: 0–30 h, so the bars stay in the lower third.
- The same in every burndown chart: in-progress and closed projects, and all themes.
