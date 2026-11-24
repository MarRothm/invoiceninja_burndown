# Implementation Plan: Timesheet and Turnover in the AI Dashboard

**Branch**: `007-ai-dashboard-timesheet-turnover` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-ai-dashboard-timesheet-turnover/spec.md`

## Summary

Add three AI building blocks: `TimesheetSummary`, `ProjectTurnover` and `TurnoverOverview`. They render data from the existing timesheet and turnover endpoints. The system prompt and the default declaration are extended so the operator controls them in plain language.

The live-display bug is fixed in the same change (research R1, confirmed against a real production stream):
- the SSE route loses `\n` inside tokens → it now sends multi-line `data:` framing;
- the prompt puts `root` last → it now puts `root = Dashboard([...])` first.

The README gets a "Dashboard composition" section that lists the declaration file, the runtime override and every block.

## Technical Context

- **Language/Version**: Node.js (ESM) for the API (Fastify); React + Vite for the frontend; `@openuidev/react-lang` / `lang-core` 0.2.x
- **Primary Dependencies**: existing ones only, no new packages
- **Storage**: N/A. The layout cache stays in memory, keyed by the declaration hash.
- **Testing**:
  - Vitest in `api/tests/` (SSE framing, prompt content)
  - a parser check script and a Docker-first manual check (quickstart)
  - `frontend/` has no test runner, and none is added (YAGNI)
- **Target Platform**: Portainer on `macmini.local` (arm64), with the host Ollama running `qwen2.5:7b`
- **Project Type**: web application (api + frontend)
- **Performance Goals**:
  - Generation with the default declaration stays well within 30 s: ≈ 6–7 s for 4 projects and ≤ 15 s for 10 (R6). The baseline today is 4.6 s.
  - The first block is visible within about 1 s of the first token.
- **Constraints**:
  - Numbers must equal the existing views exactly (data comes from the same endpoints).
  - Periods resolve at render time so the cache doesn't go stale.
- **Scale/Scope**: about 12 files changed or added; no API endpoints added

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | No new endpoints. The turnover data was already exposed (and is listed in `SECURITY.md`). | ✅ |
| II. InvoiceNinja single source of truth | The blocks read the synced data through the existing endpoints and change nothing. | ✅ |
| III. One responsibility per service | Frontend blocks call the API only. The API keeps serving REST/SSE. There are no cross-layer calls. | ✅ |
| IV. Security hygiene | No new dependencies. | ✅ |
| V. Simplicity & observable config | Existing components and endpoints are reused, and no frontend test framework is added. The UI uses design tokens only (`var(--…)`), reusing the styles from `ProjectTurnover.jsx`. | ✅ |
| Workflow: README currency | The README AI section is extended: composition, blocks, examples, runtime override. | ✅ (task) |

**Gate result**: PASS. No deviations.

**Post-design re-check**: PASS. The contract changes are compatible: the SSE framing is standards-based and the client is unchanged for tokens. The grammar only adds components plus a reordering.

## Project Structure

### Documentation (this feature)

```text
specs/007-ai-dashboard-timesheet-turnover/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ai-dashboard-stream-and-grammar.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
api/src/routes/ai-dashboard.js        # SSE write(): multi-line data framing
api/src/services/ai-dashboard.js      # SYSTEM_PROMPT: root first, 3 new components, period rules, new example
api/dashboard.declaration.md          # default: TurnoverOverview first, + TimesheetSummary per project
api/tests/routes.test.js              # framing test (token with \n → data lines)
api/tests/ai-dashboard.test.js        # prompt/declaration assertions

frontend/src/components/ai/components.js            # register TimesheetSummary, ProjectTurnover, TurnoverOverview
frontend/src/components/ai/TimesheetSummary.ai.jsx  # NEW
frontend/src/components/ai/ProjectTurnover.ai.jsx   # NEW (wraps ProjectTurnover)
frontend/src/components/ai/TurnoverOverview.ai.jsx  # NEW (compact year table)
frontend/src/components/ai/AIDashboard.jsx          # guard regex; pass onOpenTimesheet via context
frontend/src/components/TimesheetModal.jsx          # optional initialMonth prop
frontend/src/App.jsx                                # pass onOpenTimesheet(project, month) to AIDashboard

README.md                                           # "Dashboard composition" section
specs/002-openui-ai-dashboard/contracts/ai-dashboard-api.md  # superseded note (root first, framing)
```

**Structure decision**: Use the existing `api/` + `frontend/` layout. New AI blocks follow the existing `*.ai.jsx` convention in `frontend/src/components/ai/`.

## Implementation Notes

1. **SSE framing** (`routes/ai-dashboard.js`):

   ```js
   const write = (data) => raw.write(String(data).split('\n').map(l => `data: ${l}`).join('\n') + '\n\n');
   ```

2. **System prompt**:
   - Rule 1 becomes: "The FIRST statement MUST be `root = Dashboard([...])` listing every component in display order; then define each component."
   - Add the three components with their signatures.
   - Rule: "Pass a month (`"YYYY-MM"`) or year only if the declaration names a specific one; otherwise omit it."
   - Rule: "Use TimesheetSummary, ProjectTurnover or TurnoverOverview only if the declaration asks for timesheet / project turnover / turnover overview." (FR-008)
   - Replace the example with a root-first example.

3. **Frontend blocks**:
   - **Data loading**: each block reads `projects` and `onOpenTimesheet` from `AIDashboardContext` and fetches with the existing `hooks/api.js` functions (`fetchTimesheet`, `fetchProjectTurnover`, `fetchTurnover`). It shows a compact loading line, then the data or a notice.
   - **TimesheetSummary**: a `role="button"` with `tabIndex=0`. Click or Enter calls `onOpenTimesheet(project, month)`. It uses `formatHours`, `formatEUR` and `formatRate` from `utils/timesheet.js`.

4. **Empty guard** in `AIDashboard.onDone`: `/Dashboard|ProjectCard|BurndownChart|TimesheetSummary|ProjectTurnover|TurnoverOverview/`.

5. **Cache**: there's no code change. A new image restarts the API, which drops the in-memory cache, so the new prompt takes effect after the redeploy.

## Complexity Tracking

No constitution violations.
