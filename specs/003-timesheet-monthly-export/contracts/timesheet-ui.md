# Contract: Timesheet UI

## Entry points (Option C)

| Location | Element | Behaviour |
|----------|---------|-----------|
| Sidebar `ProjectCard` (all cards, legacy + AI mode) | Icon button `▦`, `title="Timesheet"`, `aria-label="Open timesheet for <name>"` | Opens overlay for that project; does **not** change the selected project |
| Legacy project header | Button "▦ Timesheet" next to the project title | Opens overlay for the selected project |

## `TimesheetModal` props

```js
<TimesheetModal project={{ id, name }} onClose={() => {}} />
```

## Overlay layout

```text
┌ Timesheet — <Project name> ───────────────────────── ✕ ┐
│ ‹  September 2026  ›         [ 1.75 | 1:45 ]           │
│ Last synced: 18 Oct 2026, 09:30                        │
├────────────────────────────────────────────────────────┤
│ Mon 31 Aug      2026-08-31            1.00             │  ← neighbouring month: greyed, no copy
│ Tue 01 Sep      2026-09-01            0.00             │  ← zero rows muted
│ Wed 02 Sep      2026-09-02            2.50  [click=copy]│
│ Sat 05 Sep      …                      …               │  ← weekend rows shaded
│ Sun 06 Sep      …                      …               │
│ Week 36 · 31 Aug – 06 Sep                       7.50   │  ← subtotal row (display-only)
│   incl. days from other month                          │
│ Mon 07 Sep      …                                      │
├────────────────────────────────────────────────────────┤
│ Total                                 6.50             │
│                       [ Copy month ]  [ Download CSV ] │
└────────────────────────────────────────────────────────┘
```

## Interaction rules

| Rule | Spec |
|------|------|
| Opens on current local month | US1-AS4 |
| `›` disabled when month = current month | FR-006 |
| Format toggle applies to rows, total, copy and CSV; persisted in `localStorage` `burndown_timesheet_format` | FR-010 |
| Click on a day's value copies that value only; brief "Copied" feedback | FR-009 |
| "Copy month" → TSV `YYYY-MM-DD\t<value>` per line, no header; "Copied N days" feedback | FR-007 |
| "Download CSV" → `timesheet_<slug>_<YYYY-MM>.csv`, BOM + `date,hours` header + one row per day | FR-008 |
| Clipboard failure → inline message "Copy not available — use Download CSV" | Edge case |
| Rows grouped by ISO week; a subtotal row follows each Sunday incl. the trailing partial week | FR-017 |
| Subtotal = full Mon–Sun week incl. neighbouring-month days; label "Week N · DD MMM – DD MMM", plus "incl. days from other month" when `spans_other_month` | FR-018 |
| Subtotal rows are not clickable and never part of Copy month / CSV | FR-019 |
| Neighbouring-month day rows: greyed (`opacity` ≈ 0.45, `var(--muted)`), value not copyable, no weekend shading; excluded from Total, Copy month, CSV | FR-020 |
| Subtotals follow the format toggle | Assumption |
| Close via ✕, `Esc`, or backdrop click; dashboard state (selection, mode) unchanged | FR-015 |
| Loading → "Loading…"; error → message + Retry | — |
| Colours only via existing CSS variables (`--card`, `--border`, `--muted`, `--accent`, `--surface`, `--text`) | FR-014, Constitution V |

## Pure helpers (`frontend/src/utils/timesheet.js`)

```js
formatHours(hours, format)            // 'decimal' → '1.75', 'hhmm' → '1:45'
toTSV(days, format)                   // month clipboard text
toCSV(days, format)                   // file content incl. BOM and header
fileName(projectName, month)          // 'timesheet_website-relaunch_2026-09.csv'
shiftMonth('2026-01', -1)             // '2025-12'
currentMonth()                        // local 'YYYY-MM'
```
