# UI Contract: AI Dashboard as the Only Dashboard

## Sidebar (top to bottom)

1. Title "Burndown" / "via InvoiceNinja". There is no dashboard toggle.
2. **↻ Sync now**: syncs, then refreshes the AI Dashboard and € Turnover (`aiReloadKey`, `turnoverKey`).
3. **€ Turnover**: toggles between the turnover overview and the AI Dashboard.
4. Spacer, then the **theme selector**.

There is no project list.

## Main area

| Condition | Shows |
|-----------|-------|
| sync error | dismissible error banner on top (any view) |
| `view = turnover` | `TurnoverOverview`; a row click shows the AI Dashboard |
| `view = dashboard` | `AIDashboard`, with these states: |
| ↳ AI unavailable (status check or stream), no cached layout | "Host Ollama unreachable" or "Model not installed on host Ollama", plus the hint; it recovers automatically |
| ↳ loading / streaming / ready / error | unchanged from features 002 and 007 |

## Timesheet

The full timesheet window opens only from `TimesheetSummary` blocks (one click). The window itself (copy / CSV, month navigation, h:mm toggle) is unchanged.

## Removed

- the dashboard toggle;
- the sidebar project cards (including the ▦ icon);
- the classic project detail (stats, burndown chart, legend, Timesheet button, turnover table in the detail);
- the localStorage key `burndown_dashboard_mode`.

## API

Unchanged.
