# Implementation Plan: Own Fixed Scale for Daily Hours in the Burndown

**Branch**: `011-burndown-daily-hours-axis` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/011-burndown-daily-hours-axis/spec.md`

## Summary

The daily booked-hours bars in the burndown chart get their own fixed scale, a second y-axis on the right running from 0 to 10 h. This axis's domain is 0–30 h, so the bars fill at most the lower third of the chart (R1). Days above 10 h are capped at 10 h and marked with ▲, and the tooltip shows the real hours (R2, R3).

The remaining-hours lines, their axis, the "Today" marker and the data are unchanged. This is a frontend-only change to `BurndownChart.jsx`, plus the README.

## Technical Context

- **Language/Version**: React + Vite frontend, unchanged; the API is untouched
- **Primary Dependencies**: Recharts 2.15 (already installed): a second `YAxis` with `yAxisId`, `Cell`, `LabelList`. Nothing is added.
- **Storage**: none; the `/api/projects/:id/burndown` response is unchanged
- **Testing**: the frontend has no test runner (YAGNI), so it is checked with `npm run build`, the Docker image build and the quickstart browser checks. The API suite (Vitest) must stay green, though nothing in it changes.
- **Target Platform**: Portainer on `macmini.local` (arm64); manual redeploy
- **Project Type**: web application (api + frontend); only the frontend changes
- **Performance Goals**: no measurable change; one extra `map` over the chart data per render
- **Constraints**:
  - design tokens `var(--…)` only;
  - fixed 0–10 h daily scale in every chart (FR-002);
  - bars in the lower third (FR-004);
  - lines and their values unchanged (FR-006).
- **Scale/Scope**: 1 component (`BurndownChart.jsx`) and the README

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | No endpoint or exposure change. | ✅ |
| II. InvoiceNinja single source of truth | Same synced time entries; display only. | ✅ |
| III. One responsibility per service | Rendering stays in the frontend; the API is untouched. | ✅ |
| IV. Security hygiene | No dependencies added. | ✅ |
| V. Simplicity & observable config | One constant (`DAILY_MAX_HOURS = 10`), not an env var: it is a display rule, not runtime config (R5). Design tokens for the axis and marker. | ✅ |
| Workflow: README currency | The "Burndown Logic" section documents the daily scale and the ▲ marking (FR-008). | ✅ (task) |

**Gate result**: PASS.

**Post-design re-check**: PASS. `contracts/ui.md` changes only the chart's rendering; there is no API contract change.

## Project Structure

### Documentation (this feature)

```text
specs/011-burndown-daily-hours-axis/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/src/components/BurndownChart.jsx   # second YAxis "daily" (right, 0–30 domain, ticks 0/5/10); capped bars + ▲; tooltip real value
README.md                                   # Burndown Logic: daily-hours scale and ▲ marking
```

Not touched: `BurndownChart.ai.jsx` and `AIDashboard.jsx` (closed section). Both render `BurndownChart`, so they inherit the change (FR-007).

**Structure decision**: use the existing layout; this is one component change.

## Implementation Notes

1. **Constants**, at the top of `BurndownChart.jsx`:
   ```js
   const DAILY_MAX_HOURS = 10;                       // fixed daily scale (spec Q1)
   const DAILY_DOMAIN    = [0, DAILY_MAX_HOURS * 3]; // bars use at most the lower third
   ```
2. **Data**: `const chartData = data.map(d => ({ ...d, daily: Math.min(d.logged ?? 0, DAILY_MAX_HOURS), over: (d.logged ?? 0) > DAILY_MAX_HOURS }))`.
   - Wrap it in `useMemo` on `[data]`.
   - Pass `chartData` to `ComposedChart`.
3. **Axes**:
   - The existing left `YAxis` keeps the default id, so the grid, the lines and the `ReferenceLine` stay bound to it unchanged.
   - Add a second axis:
     ```jsx
     <YAxis yAxisId="daily" orientation="right" domain={DAILY_DOMAIN} ticks={[0, 5, 10]}
            allowDataOverflow tick={{ fill: 'var(--muted)', fontSize: 11 }}
            axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}h`} />
     ```
   - Change the chart margin `right: 8` → `right: 0`; the axis width provides the space.
4. **Bar**:
   - Set `yAxisId="daily"` and `dataKey="daily"`, keeping `name="Daily Logged"` and the existing fill, stroke and radius.
   - Add a `<LabelList dataKey="over" content={OverMarker} />` child. `OverMarker` renders `▲` (`fill: var(--text)`, fontSize 10) centred above the bar when `value` is true, and `null` otherwise.
5. **Tooltip**: in `CustomTooltip`, show `p.payload.logged` for the `daily` series (`p.dataKey === 'daily' ? p.payload.logged : p.value`), so a capped day shows its real hours.
6. **Left axis**: its auto domain is now based on the lines only. The bars used to stretch it only in the rare case where a day exceeded the remaining hours. The line values are unchanged (SC-005).
7. **README "Burndown Logic"**: add a bullet: "**Daily hours**: bars on their own fixed scale (right axis, 0–10 h, lower third of the chart), equal in every project; days above 10 h are capped and marked ▲, the tooltip shows the real value".

## Complexity Tracking

No constitution violations.
