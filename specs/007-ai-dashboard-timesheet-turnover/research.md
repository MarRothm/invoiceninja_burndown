# Research: Timesheet and Turnover in the AI Dashboard

**Feature**: 007-ai-dashboard-timesheet-turnover | **Date**: 2026-11-24

## R1 — Root cause of "display stops after the first block" (US4, FR-014/015)

I captured a real stream from production on 2026-11-24 (`GET macmini.local:6088/api/ai-dashboard`, `qwen2.5:7b` on the host Ollama, 4 active projects, 4.6 s, 125 SSE events). I then parsed it with the installed `@openuidev/lang-core` 0.2.x parser, using `createParser` with the same root `Dashboard`.

| Input to parser | Root picked | Blocks rendered |
|-----------------|-------------|-----------------|
| What the **browser** receives (EventSource semantics) | `card2` (ProjectCard) | 1 card, 0 charts |
| What the **server** sent (newlines intact) | `root` (Dashboard) | 4 cards, 4 charts |
| Server text cut at 60 % (mid-stream, root last) | `card2` | 1 card |
| Same text with `root` moved first, cut at 60 % | `root` | 2 cards, 1 chart |

There are two independent causes.

**Cause 1, newlines lost in SSE (the main bug)**:
- The route writes `data: ${token}\n\n`. A token that contains `\n` (for example `)\n`) ends the SSE `data:` field early, so EventSource drops the line break.
- The browser therefore gets `card2 = ProjectCard(2)chart2 = BurndownChart(2)card673 = …` on a single line. The parser recognises only the first statement.
- This stays broken after `[DONE]` too, because the remount parses the same string.
- After a reload, the cache path sends the layout as one JSON event with `\n` intact, so it renders fully. This matches what the user reported exactly.

**Cause 2, root statement last**:
- Until a `root` statement exists, `pickEntryId()` falls back to the first component statement.
- Our system prompt requires `root = Dashboard([...])` as the **last** line. So even with Cause 1 fixed, only the first card would show until the very end.
- The library's own prompt rules say *"root = Root(...) FIRST line (for optimal streaming)"*. Forward references are resolved once the referenced statements arrive.

**Decision**:
1. **SSE framing**: the route emits each token as SSE multi-line data. It splits the token on `\n` and writes every part as its own `data:` line, then a blank line. EventSource joins those lines with `\n`, so the token arrives byte-identical. Cached and error payloads (single-line JSON) are unaffected, and the client token handling stays unchanged.
2. **Root first**: the system prompt and its example require `root = Dashboard([...])` as the **first** statement, followed by the component definitions in order.
3. **Empty-response guard**: the frontend guard `/ProjectCard|BurndownChart|Dashboard/` is extended to the new component names.

**Alternatives considered**:
- JSON-encode every token (`data: "…"`): it works, but it changes the event contract for every consumer and needs client changes. Multi-line `data:` is the standard SSE mechanism.
- Accumulate tokens on the client and re-parse only at `[DONE]`: that fixes the final view but not live growth (FR-014).
- Keep root last and render orphaned statements: the library drops unreferenced statements by design.

## R2 — New building blocks and their arguments

**Decision** (positional args, like the existing blocks):

| Block | Signature | Default when arg omitted |
|-------|-----------|--------------------------|
| `TimesheetSummary` | `TimesheetSummary(projectId, month?)`, where month is `"YYYY-MM"` | current month, resolved **at render time** |
| `ProjectTurnover` | `ProjectTurnover(projectId)` | all years with invoices |
| `TurnoverOverview` | `TurnoverOverview(year?)`, where year is an integer | current year, resolved **at render time** |

**Rationale**:
- The layout cache is keyed only by the declaration hash. If the AI wrote the current month into the layout, a cached layout would go stale at the turn of the month.
- The prompt therefore tells the model to pass a month or year **only** when the declaration names a specific one (FR-007).

## R3 — Data source for the new blocks

**Decision**:
- The blocks fetch their data client-side from the existing endpoints, the same way `BurndownChart.ai.jsx` uses `fetchBurndown`:
  - `GET /api/projects/:id/timesheet?month=YYYY-MM` returns `total`, `rate` and `amount`.
  - `GET /api/projects/:id/turnover`
  - `GET /api/turnover?year=YYYY`
- The amounts are therefore identical to the existing views by construction (FR-005, SC-001).
- No new API endpoints are needed, and the prompt payload sent to the model is not changed. The model only needs project IDs.

**Alternatives considered**: send turnover and timesheet figures to the model. Rejected: it makes the prompt longer, the model never needs the numbers, and the model could restate them wrongly.

## R4 — Opening the full timesheet (FR-004)

**Decision**:
- `TimesheetModal` gets an optional `initialMonth` prop, defaulting to the current month as today.
- `App.jsx` passes an `onOpenTimesheet(project, month)` callback into `AIDashboard`, which puts it on `AIDashboardContext`.
- `TimesheetSummary` calls it on click or Enter.
- The modal is reused unchanged, including copy and CSV.

## R5 — Reuse of the existing turnover UI

**Decision**:
- `ProjectTurnover.ai.jsx` wraps the existing `ProjectTurnover` component (`projectId` prop).
- `TurnoverOverview.ai.jsx` reuses the exported building blocks of `ProjectTurnover.jsx` (`cardStyle`, `TurnoverHead`, `AmountCells`, `TurnoverFooter`) to render a compact read-only year table without the year selector. The existing `TurnoverOverview` couples a year selector and navigation, which the AI block doesn't need.

## R6 — Generation time (SC-003)

- **Baseline**: 4 projects with card and chart take 4.6 s (≈125 events).
- **Default declaration**: adds 1 `TimesheetSummary` per project plus 1 `TurnoverOverview`. That is about +35 % output, so ≈ 6–7 s for 4 projects and ≈ 15 s for 10 projects, well within 30 s.
- **Verification**: measured in T-validation against the host Ollama with the new prompt. If it fails, shorten the variable names in the prompt example (`c1`, `b1`, `t1`).

## R7 — Testing

- **API**:
  - A route test checks that a token containing `\n` is framed as multi-line `data:`.
  - A service test checks the system prompt text: root first, new components listed.
- **Frontend**: there is no test runner in `frontend/`. Adding one just for this would be YAGNI (Principle V). Instead:
  - a Node script check (quickstart) re-runs the R1 parser comparison against a captured stream;
  - then a Docker-first manual check.
