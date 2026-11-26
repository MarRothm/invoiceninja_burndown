# Implementation Plan: Full-Width Dashboard with Menu, Closed Projects and Lump-Sum Marking

**Branch**: `010-header-menu-closed-projects` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/010-header-menu-closed-projects/spec.md`

## Summary

- **Header and menu**: the sidebar is replaced by a header with a ☰ menu holding Sync now, "Show closed projects" and Theme.
- **Year switching**: the separate turnover view and its button are removed. The AI Dashboard's turnover overview block gets ‹ / › year switching.
- **AI unavailable**: the same block also appears below the status message (Q3).
- **Closed projects**: the toggle adds a fixed "Closed projects" section below the generated layout, built from the existing blocks (card and burndown, or card and turnover for lump-sum projects). They are not sent to the AI (R1).
- **Lump-sum rows**: `/api/turnover` gains `billing_mode` per row, so lump-sum rows show a `LUMP SUM` badge (R3).

## Technical Context

- **Language/Version**: Node.js (Fastify API) and React + Vite (frontend), both unchanged
- **Primary Dependencies**: existing only; nothing added
- **Storage**: Postgres, unchanged schema (reads `projects.raw->'tags'`, which already exists). One new localStorage key, `burndown_show_closed`.
- **Testing**: API Vitest. `turnover.test.js` gets a `billing_mode` test and the narrowed 008 no-filter test. The frontend is checked with `npm run build` and the quickstart browser checks (no test runner, YAGNI).
- **Target Platform**: Portainer on `macmini.local` (arm64); manual redeploy
- **Project Type**: web application (api + frontend)
- **Performance Goals**:
  - year switch < 1 s with no regeneration (SC-003);
  - toggle instant;
  - turnover visible within 3 s when the AI is unavailable (SC-007).
- **Constraints**:
  - the turnover figures and totals stay identical (SC-005);
  - design tokens `var(--…)` only;
  - no menu or UI library.
- **Scale/Scope**:
  - 1 new component (`HeaderMenu.jsx`) and 1 small shared `Badge.jsx`;
  - `App.jsx` slimmed;
  - `TurnoverOverview.jsx` turned into a block;
  - `AIDashboard.jsx` extended;
  - 1 API service field and tests;
  - README.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | No new endpoint or exposure; one additive response field. | ✅ |
| II. InvoiceNinja single source of truth | The billing mode is still derived from the synced InvoiceNinja tags; nothing is stored locally. | ✅ |
| III. One responsibility per service | The API derives the data, the frontend renders it; no new service. | ✅ |
| IV. Security hygiene | No dependencies added. | ✅ |
| V. Simplicity & observable config | One shared turnover block instead of two (removes the duplicate). The closed section reuses the AI blocks. No prompt or cache change. | ✅ |
| Workflow: README currency | Sidebar, € Turnover, Timesheet and lump-sum wording updated; toggle and menu documented (FR-009). | ✅ (task) |

**Gate result**: PASS.

**Post-design re-check**: PASS. `contracts/api.md` is additive only. `contracts/ui.md` removes the sidebar and turnover view, and adds the header, menu, year switching and closed section.

## Project Structure

### Documentation (this feature)

```text
specs/010-header-menu-closed-projects/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/api.md
├── contracts/ui.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
api/src/services/turnover.js                    # getYearTurnover: select tags, add billing_mode per row (isLumpSum)
api/tests/turnover.test.js                      # billing_mode per row; narrow the 008 "no filter" test to the WHERE clause
frontend/src/App.jsx                            # header + HeaderMenu instead of sidebar; showClosed state (localStorage); drop view/turnoverKey/TurnoverOverview
frontend/src/components/HeaderMenu.jsx          # NEW: ☰ dropdown (Sync now, Show closed projects, ThemeSelector); outside click / Escape
frontend/src/components/Badge.jsx               # NEW: small uppercase badge (LUMP SUM, CLOSED), design tokens
frontend/src/components/TurnoverOverview.jsx    # becomes a block: initialYear prop, ‹ year ›, no page heading, rows not clickable, LUMP SUM badge
frontend/src/components/ai/TurnoverOverview.ai.jsx  # thin wrapper around TurnoverOverview (resolveYear)
frontend/src/components/ai/AIDashboard.jsx      # showClosed prop → ClosedProjects section when ready; unavailable state → + TurnoverOverview
frontend/src/components/ai/ProjectCard.ai.jsx   # CLOSED badge for status 'closed' (hourly + lump-sum card); LUMP SUM via Badge
frontend/src/components/ai/TimesheetSummary.ai.jsx  # guard: return null for closed projects
frontend/src/components/ThemeSelector.jsx       # optional: drop its top border when used inside the menu
frontend/src/index.css                          # .sidebar palette → .app-header
README.md                                       # header menu, year switching, closed toggle, LUMP SUM badge; drop sidebar / € Turnover
```

**Structure decision**: use the existing layout. Add two small components and remove the separate turnover view.

## Implementation Notes

1. **API, `getYearTurnover`**:
   - Add `p.raw->'tags' AS tags` to the SELECT and GROUP BY `p.id, p.name, p.raw->'tags'` (or `GROUP BY p.id`, since `id` is the primary key).
   - Map each row to `billing_mode: isLumpSum(tags) ? 'lump_sum' : 'hourly'`, and do not include `tags` in the output.
   - The WHERE clause and ORDER BY stay byte-identical.
2. **`TurnoverOverview` block**:
   - Props: `{ initialYear }`. State: `year = initialYear ?? currentYear`.
   - The `years` logic is unchanged.
   - Layout:
     - `cardStyle` with `marginBottom: 16`;
     - a header row with "TURNOVER" (11 px, muted), a spacer, then ‹ year ›.
   - Remove `hovered`, `role="button"`, `onClick`, `onSelectProject` and `reloadKey`.
   - Name cell: name plus `<Badge>LUMP SUM</Badge>` when `p.billing_mode === 'lump_sum'`.
3. **`TurnoverOverview.ai.jsx`**: `export default ({ props: { year } }) => <TurnoverOverview initialYear={resolveYear(year)} />`.
4. **`AIDashboard`**:
   - Add the prop `showClosed = false`.
   - **Unavailable branch**: after the existing message, render `<div style={{ textAlign: 'left', marginTop: 32 }}><TurnoverOverview /></div>`.
   - **Ready branch**: after the `Renderer`, if `showClosed && status === 'ready'`, render `<ClosedProjects projects={projects} />` (an in-file component inside the context provider).
     - It filters `status === 'closed'` and sorts by `closedOrder`, which mirrors the API's `displayOrder`.
     - It renders `ProjectCardAI` and either `BurndownChartAI` or, for lump-sum projects, `ProjectTurnoverAI`, all with `props={{ projectId }}`.
     - It shows "No closed projects." when the list is empty.
5. **`ProjectCard.ai.jsx`**:
   - `project.status === 'closed'` → `<Badge>CLOSED</Badge>` before the StatusBadge or percentage.
   - LumpSumCard uses `<Badge>LUMP SUM</Badge>` and adds CLOSED the same way.
6. **`TimesheetSummary.ai.jsx`**: return null for `project?.status === 'closed'`. This is defensive, since closed projects are never in the prompt.
7. **`HeaderMenu`**:
   - Props: `{ syncing, onSync, showClosed, onToggleClosed, themeKey, setThemeKey }`.
   - The `open` state uses a `ref` and a document `mousedown` / `keydown` (Escape) listener that is active only while open.
   - The dropdown is absolute, right-aligned, with `z-index` above the main area and `var(--card)` / `var(--border)`.
8. **`App.jsx`**:
   - Layout: `<header className="app-header">` with the title and `<HeaderMenu>`, then `<main>` with the error banner and `<AIDashboard … showClosed={showClosed} />`.
   - `showClosed` is initialised from `localStorage.getItem('burndown_show_closed') === '1'`. Each change writes `'1'` / `'0'`.
   - Remove `view`, `turnoverKey`, `openProjectFromTurnover` and the `TurnoverOverview` import. `handleSync` bumps `aiReloadKey` only.
9. **README**:
   - "Dashboard": header with ☰ (Sync now, Show closed projects, Theme), no sidebar.
   - "Turnover": ‹ / › in the dashboard's turnover overview, no € Turnover button or row click, `LUMP SUM` badge, and shown below the message when the AI is unavailable.
   - Document the closed-projects section.
   - API: `billing_mode` in `/api/turnover` rows.

## Complexity Tracking

No constitution violations.
