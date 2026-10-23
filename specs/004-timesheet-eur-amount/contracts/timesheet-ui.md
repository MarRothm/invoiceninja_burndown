# Contract Delta: Timesheet Overlay

Extends [003 timesheet-ui.md](../../003-timesheet-monthly-export/contracts/timesheet-ui.md).

## Footer total

```
Total                                   37.50
                          @ 95.00 €/h   3,562.50 €
```

- Second line under the hours total: rate (muted, 11px) and amount (accent, tabular numbers).
- No rate: `—` instead of the amount and the muted hint `No hour rate set` instead of the rate.

## Weekly subtotal row

- Amount shown right-aligned under the week's hours (muted, 11px, tabular numbers); `—` when no rate.

## Unchanged

- Day rows, month navigation, format toggle, Copy month, single-value copy, Download CSV.
- EUR values do not change when toggling `1.75 / 1:45`.
- Styling only via existing CSS variables (`--muted`, `--accent`, `--text`, `--border`).

## Formatting

| Value | Output |
|-------|--------|
| `3562.5` | `3,562.50 €` |
| `0` (rate set) | `0.00 €` |
| `null` | `—` |
| rate `95` | `@ 95.00 €/h` |
