# Research: Full-Width Dashboard with Menu, Closed Projects and Lump-Sum Marking

## R1 — How closed projects get onto the AI Dashboard

- **Decision**: Closed projects are **not sent to the AI**. When "Show closed projects" is on, the AI Dashboard renders a fixed **"Closed projects"** section below the generated layout.
  - It is built from the existing AI blocks: `ProjectCard` + `BurndownChart`, or `ProjectCard` + `ProjectTurnover` for lump-sum projects.
  - The order mirrors the API's `displayOrder`: hourly projects by progress, then lump-sum projects by earned %.
  - Each card carries a `CLOSED` badge.
- **Rationale**:
  - SC-004 requires that 100 % of closed projects appear. The 7b model already needs prompt rule 5 not to skip in-progress projects. More projects in the prompt raise both the risk of skipped projects and of hitting the 30 s timeout.
  - The toggle switches instantly. There is no regeneration and no second cache entry.
  - It uses the same block components, so there is still one implementation (feature 009, SC-006).
  - Feature 008's lump-sum rules hold by construction.
- **Alternatives considered**:
  - (a) `include_closed` query parameter plus a prompt rule for closed projects, with a cache entry per toggle state. Rejected: it is not deterministic, slower, and needs a new prompt rule and cache key.
  - (b) Let the declaration decide. Rejected: the toggle must work without editing the declaration.
- **Spec impact**: the assumption "Turning the toggle regenerates the AI Dashboard" is replaced. The toggle shows or hides the section without regeneration.

## R2 — Year switching inside the dashboard

- **Decision**: Turn `frontend/src/components/TurnoverOverview.jsx` into a reusable **block** with its own ‹ / › year state.
  - Props: `initialYear`.
  - It keeps the existing `years_available` logic.
  - It no longer has a page heading, and its rows are not clickable.
  - `TurnoverOverview.ai.jsx` becomes a thin wrapper: `<TurnoverOverview initialYear={resolveYear(year)} />`.
- **Rationale**: one component serves both the AI block and the AI-unavailable screen (R4). Its figures, limits and empty states equal the former view (FR-004, SC-003). The year is component state, so a remount (regeneration or sync) resets it to the default year (US2-3).
- **Alternatives considered**: keeping two components. Rejected because it duplicates code, which goes against feature 009.

## R3 — Lump-sum marking in the turnover overview

- **Decision**: `GET /api/turnover?year=` returns `billing_mode` (`"hourly"` | `"lump_sum"`) per project row.
  - It is derived in `getYearTurnover` from `p.raw->'tags'` with the existing `isLumpSum`.
  - The SELECT and GROUP BY gain the tags column. The WHERE clause does not change, so the figures don't either.
  - The frontend shows a `LUMP SUM` badge next to the name.
- **Rationale**: the overview also lists archived projects, which `/api/projects` does not return. Only the API sees every row's tags. It is a small, additive field and is tested.
- **Alternatives considered**: matching rows in the frontend against `/api/projects`. Rejected: archived lump-sum projects would stay unmarked, and the AI-unavailable screen would need an extra request.
- **Test impact**: the 008 test "does not filter by billing mode" checks that the SQL contains no `tags`. It is narrowed to the WHERE clause, which is its intent, and a test for `billing_mode` per row is added.

## R4 — AI-unavailable screen

- **Decision**: the `unavailable` state of `AIDashboard` renders the status message and then `<TurnoverOverview initialYear={currentYear} />`.
- **Rationale**: Q3 → A. Turnover needs no AI, and the same block appears as on the dashboard. The existing auto-retry effect replaces both once the AI is back.
- **Alternatives considered**: showing it on the `error` state too. Rejected: that state is outside the spec, and it already has a "Try again" button.

## R5 — Header and menu

- **Decision**:
  - Replace the sidebar with a header bar: title "Burndown · via InvoiceNinja" on the left, a ☰ button on the right.
  - The ☰ button opens a dropdown (new `HeaderMenu.jsx`) with:
    - **↻ Sync now**, showing "Syncing…" while running; the menu closes on click;
    - a **Show closed projects** checkbox;
    - the **theme** selector (the existing `ThemeSelector`).
  - The menu closes on outside `mousedown` and on Escape. The button has `aria-expanded`.
  - The fixed dark palette moves from `.sidebar` to `.app-header` in `index.css`.
  - The error banner stays at the top of `<main>`.
- **Rationale**: no dependency is added, and the design tokens and existing palette are kept. The toggle sits in the menu, as the spec assumes.
- **Alternatives considered**: a menu library. Rejected (YAGNI). A toggle in the header bar itself was also rejected: it adds clutter, and the spec puts it in the menu.

## R6 — Persisting the toggle

- **Decision**: store it in localStorage `burndown_show_closed` as `'1'` / `'0'`, default off. It is held in `App.jsx` and passed to `AIDashboard` as `showClosed`.
- **Rationale**: same pattern as the theme and the timesheet format.

## R7 — State removed from `App.jsx`

- **Decision**: remove `view`, `turnoverKey`, `openProjectFromTurnover` and the `TurnoverOverview` import. `handleSync` only bumps `aiReloadKey`, which remounts the dashboard and its turnover block.
