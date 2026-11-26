# Implementation Plan: AI Dashboard as the Only Dashboard

**Branch**: `009-ai-dashboard-only` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/009-ai-dashboard-only/spec.md`

## Summary

Remove the classic dashboard so the AI Dashboard is the only view:
- the dashboard toggle;
- the sidebar project list;
- the classic project detail.

These stay unchanged: € Turnover, Sync now, the theme selector, the timesheet window (opened from AI timesheet blocks) and the whole API.

Three gaps that the classic view used to hide are closed:
- **AI unavailable**: the message now appears within about 3 s, using the existing status poll (R2).
- **Sync errors**: they are now visible in every view (R4).
- **Stored preference**: the stale toggle setting is cleared (R3).

## Technical Context

- **Language/Version**: React + Vite (frontend only); Node.js API unchanged
- **Primary Dependencies**: existing only; nothing added
- **Storage**: N/A. One obsolete localStorage key is removed.
- **Testing**:
  - The API Vitest suite must stay green and unchanged; there are no API changes.
  - The frontend has no test runner (YAGNI). It is checked with `npm run build`, the Docker-first quickstart and the macmini checklist.
- **Target Platform**: Portainer on `macmini.local` (arm64)
- **Project Type**: web application (api + frontend)
- **Performance Goals**:
  - the unavailable message shows within 3 s (status check timeout 3 s);
  - recovery takes ≤ 15 s (status poll interval).
- **Constraints**: AI Dashboard and € Turnover figures stay identical (FR-009, SC-005). Design tokens only.
- **Scale/Scope**:
  - 2 files deleted (`DashboardToggle.jsx`, `ProjectCard.jsx`);
  - `App.jsx` slimmed (about −200 lines);
  - small changes in `AIDashboard.jsx` and the README.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | No endpoint or exposure changes. | ✅ |
| II. InvoiceNinja single source of truth | No data changes. | ✅ |
| III. One responsibility per service | Frontend only; it still calls only the API. | ✅ |
| IV. Security hygiene | No dependencies added; less code. | ✅ |
| V. Simplicity & observable config | Removes a duplicate implementation (YAGNI). The `/api/health` and AI status endpoints are unchanged. Design tokens are kept. | ✅ |
| Workflow: README currency | The README views, Timesheet, Turnover and lump-sum sections must drop the legacy/toggle references. | ✅ (task) |

**Gate result**: PASS.

**Post-design re-check**: PASS. The API contract is unchanged. The UI contract in `contracts/ui.md` only removes elements and adds the faster unavailable state.

## Project Structure

### Documentation (this feature)

```text
specs/009-ai-dashboard-only/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ui.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/src/App.jsx                         # remove toggle, project list, classic detail; error banner for all views; aiStatus 'checking'; clear localStorage key; turnover click → AI Dashboard
frontend/src/components/DashboardToggle.jsx  # DELETE
frontend/src/components/ProjectCard.jsx      # DELETE (classic card; AI uses ai/ProjectCard.ai.jsx)
frontend/src/components/ai/AIDashboard.jsx   # loading + status unavailable/model_missing (not cached) → unavailable state
api/src/routes/ai-dashboard.js               # comment only ("toggle enablement" → "AI availability")
README.md                                    # single-dashboard wording; remove legacy/toggle/sidebar-card references
```

**Structure decision**: Use the existing layout. Remove code only; no new components.

## Implementation Notes

1. **`App.jsx`**:
   - **Remove these imports**: `ProjectCard`, `BurndownChart`, `DashboardToggle`, `ProjectTurnover`, `fetchProjects`, `fetchBurndown`, `formatMoney`.
   - **Remove this state**: `projects`, `selected`, `burndown`, `loading`, `chartLoad`, `dashMode`.
   - **Remove these functions and effects**: `loadProjects` and its effect, `handleToggle`, the `current` / `isLumpSum` / `selectedLumpSum` derivations, the burndown effect, and `Stat`.
   - **Add a one-off effect**: `localStorage.removeItem('burndown_dashboard_mode')`.
   - **`aiStatus`**: the initial value becomes `{ ollama: 'checking', cached: false }`.
   - **`handleSync`**: run `triggerSync()`, then bump `aiReloadKey` and `turnoverKey`. It no longer calls `loadProjects`.
   - **`openProjectFromTurnover`**: becomes `() => setView('dashboard')`.
   - **Main area**:
     - the error banner (moved out of the legacy block);
     - then `view === 'turnover'` → `TurnoverOverview`;
     - else → `AIDashboard` (no `dashMode` condition).
   - **Sidebar**: title, Sync now, € Turnover, spacer, ThemeSelector.
2. **`AIDashboard.jsx`**:
   - Add a prop `cached` (from `aiStatus.cached`).
   - Add an effect on `[ollamaStatus, cached]`: if `statusRef.current === 'loading'`, `ollamaStatus` is `unavailable` or `model_missing`, and `!cached`, then:
     - call `closeRef.current?.()`;
     - clear both timers;
     - set the status to `unavailable`.
   - The existing auto-retry effect handles recovery.
3. **README**:
   - Replace "Switching Views" with a short "Dashboard" note: the AI Dashboard is the only view, plus the unavailable behaviour.
   - Timesheet: it opens from the timesheet summary blocks.
   - Turnover: drop the project-detail table bullet; a row click returns to the AI Dashboard.
   - Lump-sum table: drop the "Project card" and "Project detail" rows (classic), and keep the AI Dashboard and Turnover rows.

## Complexity Tracking

No constitution violations.
