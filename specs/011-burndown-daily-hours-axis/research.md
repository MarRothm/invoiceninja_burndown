# Research: Own Fixed Scale for Daily Hours in the Burndown

## R1: Second axis with a stretched domain, not a separate strip

- **Decision**: Add a second Recharts `YAxis` (`yAxisId="daily"`, right side) with domain `[0, 30]` and ticks `0/5/10`. A 10 h day then reaches one third of the plot height, so the bars stay in the lower third, below the lines.
- **Rationale**: It keeps today's single-chart look, with the bars "at the bottom" as the operator described. It also keeps one shared x-axis, one tooltip and one "Today" marker. Only the tick labels 0–10 h are shown, so the empty upper range reads as headroom.
- **Alternatives considered**:
  - A separate small chart below the burndown: this means two charts, synced tooltips and duplicated x-axes, which is more code and noise.
  - Domain `[0, 10]`: bars would reach the full height and cover the lines (FR-004).

## R2: Overflow is capped and marked with ▲

- **Decision**: Plot `daily = min(logged, 10)`. Days with `logged > 10` show a `▲` marker (`var(--text)`) above the capped bar.
- **Rationale**: A capped bar at the scale top plus an explicit marker cannot be misread as exactly 10 h (FR-005). A text glyph needs no extra assets.
- **Alternatives considered**:
  - `allowDataOverflow` alone: it clips silently, with no marking.
  - A different bar colour: this conflicts with theme bar colours and is less obvious.
  - `var(--danger)` for the marker: a long day is not an error.

## R3: The tooltip shows the real value

- **Decision**: For the `daily` series, the tooltip prints `payload.logged`, not the plotted value.
- **Rationale**: This is required by FR-005 / US2-2. Other series are unchanged.

## R4: The existing axis keeps its default id

- **Decision**: Only the new axis gets an id. The left axis, the `CartesianGrid`, the `Line`s and the `ReferenceLine` stay on the default `yAxisId` 0.
- **Rationale**: This is the minimal diff, and it avoids Recharts' "axis id not found" invariant on components without an explicit id. The grid lines stay aligned with the remaining-hours ticks.

## R5: A constant, not configuration

- **Decision**: `DAILY_MAX_HOURS = 10` is a module constant in `BurndownChart.jsx`.
- **Rationale**: The spec fixes 10 h and says it is not configurable (YAGNI). An env var would need build-time wiring in the static frontend for no current need.

## R6: Verification

- **Decision**: Verify with a frontend build and the quickstart browser checks; there are no new automated tests.
- **Rationale**: The frontend has no test runner, adding one is out of scope (YAGNI), and the API is unchanged.
