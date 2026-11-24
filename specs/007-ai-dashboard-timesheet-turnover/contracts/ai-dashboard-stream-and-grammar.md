# Contract Delta: AI Dashboard Stream and Component Grammar

**Feature**: 007-ai-dashboard-timesheet-turnover
**Base contract**: `specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md` (as amended by 006)

## 1. GET /api/ai-dashboard: SSE token framing (CHANGED)

The server writes each streamed token as SSE **multi-line data**. If the token contains `\n`, it is split on `\n`, every part goes on its own `data:` line, and the event ends with a blank line:

```text
token ")\n"           →  data: )\n
                         data: \n
                         \n
token "card2 = Pro"   →  data: card2 = Pro\n
                         \n
```

EventSource joins the `data:` lines of one event with `\n`, so `event.data` equals the token byte for byte. The client keeps concatenating `event.data` as it does today.

The cached event (`{"cached":true,"layout":…}`), the error events and `[DONE]` are unchanged: each is a single line.

**Invariant**: the concatenation of all streamed `event.data` values equals the layout that is cached for the next request.

## 2. Layout grammar (CHANGED)

- `root = Dashboard([...])` **MUST be the first statement**. This was previously the last statement.
- Component definitions follow, in display order.

```text
root = Dashboard([to, card2, chart2, ts2, card673, chart673, ts673])
to = TurnoverOverview()
card2 = ProjectCard(2)
chart2 = BurndownChart(2)
ts2 = TimesheetSummary(2)
card673 = ProjectCard(673)
chart673 = BurndownChart(673)
ts673 = TimesheetSummary(673)
```

| Component | Positional args | Notes |
|-----------|-----------------|-------|
| `Dashboard` | `children[]` | root, required, first line |
| `ProjectCard` | `projectId` | unchanged |
| `BurndownChart` | `projectId` | unchanged |
| `TimesheetSummary` | `projectId`, `month?` (`"YYYY-MM"`) | **new**; omit `month` unless the declaration names one |
| `ProjectTurnover` | `projectId` | **new**; only when the declaration asks for per-project turnover |
| `TurnoverOverview` | `year?` (int) | **new**; omit `year` unless the declaration names one |

The renderer ignores unknown components.

## 3. Frontend component contract

| Prop / callback | Where | Purpose |
|-----------------|-------|---------|
| `onOpenTimesheet(project, month)` | `AIDashboard` prop → `AIDashboardContext` | `TimesheetSummary` opens the existing `TimesheetModal` |
| `initialMonth` (optional) | `TimesheetModal` | Month shown first; defaults to the current month (unchanged behaviour) |
