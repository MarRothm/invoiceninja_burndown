# UI Contract: Burndown Chart (feature 011)

Applies to every rendering of `BurndownChart`: AI Dashboard blocks and the closed-projects section.

| Element | Before | After |
|---------|--------|-------|
| Left axis (remaining hours) | shared by lines and bars | lines only; ticks/format `Nh` unchanged |
| Right axis | none | daily hours, ticks `0h / 5h / 10h`, muted, no axis line |
| Daily bars | height relative to budget | fixed scale: 10 h = 1/3 of plot height, same in all charts |
| Day > 10 h | bar per budget scale | bar capped at 10 h with `▲` above it |
| Tooltip "Daily Logged" | plotted value | real booked hours (e.g. `12.5h` for a capped day) |
| Ideal / Actual / Forecast, Today marker | — | unchanged |

Styling uses design tokens only: `var(--muted)` for the axis and `var(--text)` for the marker. The bars keep the theme's `barFill` / `barStroke`.
