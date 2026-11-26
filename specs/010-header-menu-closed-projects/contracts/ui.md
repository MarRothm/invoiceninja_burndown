# UI Contract: Feature 010

## Header (full width, top)

- Left: **Burndown**, with "via InvoiceNinja" beside or below it.
- Right: the **☰** button (`aria-label="Menu"`, `aria-expanded`).
- It uses the fixed dark palette (formerly the sidebar's).

## Menu (dropdown under ☰)

1. **↻ Sync now**: shows "↻ Syncing…" and is disabled while running. The menu closes on click. Afterwards the AI Dashboard remounts.
2. **Show closed projects**: a checkbox, persisted in `burndown_show_closed`.
3. **Theme**: the existing selector; the choice applies immediately and is persisted.

The menu closes on outside click, Escape, and after Sync now.

## Main area (full width)

1. The sync error banner (dismissible), when there is an error.
2. The AI Dashboard:
   - **generated layout**: unchanged, except that the `TurnoverOverview` block now has ‹ year ›;
   - **"Closed projects" section** (only when the toggle is on and the status is `ready`): a heading "CLOSED PROJECTS", then card and burndown per closed project (card and project turnover for lump-sum projects);
   - **AI unavailable**: reason and hint, then the turnover overview block.

## Turnover overview block

- Header: "TURNOVER", then ‹ year ›. ‹ / › step through `years_available` plus the current year. › is disabled at the newest year, ‹ at the oldest.
- Rows: name, plus a `LUMP SUM` badge for `billing_mode = "lump_sum"`, then Invoiced, Paid and Open. Rows are **not** clickable.
- The total row, empty state "No invoices in <year>", error with Retry, and the footer "as of last sync" are unchanged.

## Removed

- the left sidebar;
- the "€ Turnover" button;
- the separate turnover view, including the row-click navigation.
