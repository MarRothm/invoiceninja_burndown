# Research: AI Dashboard as the Only Dashboard

## R1 — Inventory: what is classic-only, what is shared

| Item | Used by | Decision |
|------|---------|----------|
| `frontend/src/components/DashboardToggle.jsx` | App sidebar only | **Delete** |
| `frontend/src/components/ProjectCard.jsx` (classic card) | App sidebar only (the AI uses `ai/ProjectCard.ai.jsx`) | **Delete** |
| Classic detail in `App.jsx`: `selected`, `burndown`, `chartLoad`, `Stat`, lump-sum stats, chart and legend, `fetchBurndown` effect, `loadProjects`, `dashMode`, `handleToggle` | App only | **Remove** |
| `frontend/src/components/BurndownChart.jsx` | `ai/BurndownChart.ai.jsx` | Keep |
| `frontend/src/components/ProjectTurnover.jsx` (component + shared styles) | `ai/ProjectTurnover.ai.jsx`, `ai/TurnoverOverview.ai.jsx`, `TurnoverOverview.jsx` | Keep |
| `TurnoverOverview.jsx`, `TimesheetModal.jsx`, `ThemeSelector.jsx` | € Turnover, Timesheet, theme | Keep |
| `hooks/api.js` `fetchProjects`, `fetchBurndown` | AI blocks / `AIDashboard` | Keep (still used) |
| API endpoints | All used by AI blocks or € Turnover | **No change** (FR-009) |
| `index.css` `.sidebar` | Sidebar (still exists) | Keep |

- **Decision**: delete only the code above. The API is untouched. The single comment in `api/src/routes/ai-dashboard.js` that says "for toggle enablement" is reworded.
- **Rationale**: SC-006 is a single implementation per building block. After the deletion, every block exists only as an AI block.

## R2 — Showing "AI unavailable" quickly (SC-004: within 3 s)

- **Problem**:
  - Today the unavailable message appears only after the generation stream fails.
  - With a stopped Ollama (connection refused) this is immediate.
  - With an unreachable host it takes up to the 30 s Ollama timeout.
  - Until now the classic dashboard hid this problem.
- **Decision**: the App already polls `GET /api/ai-dashboard/status` (3 s timeout, every 15 s). `AIDashboard` now also uses that result:
  - While the dashboard is still `loading` (no token and no cached layout yet), a status of `unavailable` or `model_missing` closes the stream and shows the unavailable message.
  - **Exception**: if the status says `cached: true`, the layout is served from the API cache without Ollama. In that case generation is not aborted, and the cached AI layout is shown (it is a real AI layout, not a substitute, so it is consistent with Q1 → A).
  - The App's initial status becomes `checking` instead of `unavailable`, so no message flashes before the first check.
  - **Recovery**: the existing auto-retry (status → `ready` while `unavailable`/`error`) regenerates the layout within one poll interval (≤ 15 s, which satisfies SC-004's 30 s).
- **Alternatives considered**: shortening the API's Ollama timeout. This was rejected because it would also cut legitimate slow generations (up to about 15 s for 10 projects).

## R3 — Stale dashboard preference (FR-003)

- **Decision**: on App start, run `localStorage.removeItem('burndown_dashboard_mode')` once, then never read it.
- **Rationale**: it clears the obsolete key, and old values have no effect.

## R4 — Sync errors without the classic view

- **Finding**: `handleSync` writes failures to `error`, which today renders **only inside the classic view**. In AI mode, sync errors were silently invisible.
- **Decision**: render the dismissible error banner above the main area, whatever the view (AI Dashboard or € Turnover).

## R5 — Turnover row click (FR-007)

- **Decision**: keep the rows clickable (keyboard accessible, unchanged markup). `onSelectProject` now just does `setView('dashboard')`, which shows the AI Dashboard.
- **Alternative considered**: making the rows non-clickable. This was rejected because the spec (US3-AS3) wants the click to lead to the AI Dashboard.

## R6 — Timesheet access (FR-006)

- **Finding**: the `TimesheetSummary` AI block already opens the full timesheet (`onOpenTimesheet(project, month)`), and the default declaration includes one per project. Lump-sum projects have none (feature 008).
- **Decision**: no new code. Remove the classic sidebar ▦ entry point together with the list.
