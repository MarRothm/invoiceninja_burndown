# Feature Specification: AI Dashboard as the Only Dashboard

**Feature Branch**: `009-ai-dashboard-only`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "remove the non-ai dashboard implementation and make the AI dashboard the only implementation"

## Context

The application offers two dashboards today, switched with a toggle in the sidebar:

- **Classic (non-AI) dashboard**:
  - a sidebar list of project cards;
  - a project detail view with hour or lump-sum figures, burndown chart, Timesheet button and project turnover.
- **AI Dashboard**: a layout composed by the AI from the operator's plain-language declaration. It uses the same building blocks: project card, burndown, timesheet summary, project turnover and turnover overview.

The toggle remembers the last choice per browser. When the AI is unavailable, the toggle is disabled and the classic dashboard is the only working view.

Since features 002–008, the AI Dashboard covers what the operator uses. Maintaining both doubles every change; feature 008, for example, had to implement lump-sum projects twice. This feature removes the classic dashboard, so the AI Dashboard is the single dashboard.

The **Turnover overview** ("€ Turnover"), the **full Timesheet window**, **Sync now** and the **theme selector** are not part of the classic dashboard. They stay available.

## Clarifications

### Session 2026-11-25

- Q: What does the main screen show while the AI is unavailable? → A: A status message with the reason ("Host Ollama unreachable" / "AI model not installed"), retrying automatically. There is no substitute layout.
- Q: What happens to the sidebar project list and the classic project detail? → A: Both are removed. Projects appear only on the AI Dashboard, and the full timesheet opens from the AI timesheet blocks. A click on a project in "€ Turnover" opens the AI Dashboard.
- Q: What happens with lump-sum projects when the classic project cards and detail are removed? → A: Nothing is lost. On the AI Dashboard, every in-progress lump-sum project keeps its lump-sum card from feature 008 (`LUMP SUM` badge, agreed lump sum, invoiced, earned % with bar), followed by its project turnover per year, with no burndown or timesheet. That covers everything the classic detail showed (Agreed / Invoiced / Earned and the turnover). Only the duplicate classic sidebar card and detail go away. Closed lump-sum projects follow the same rule as all projects: they are not on the dashboard, and their turnover stays in "€ Turnover".

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The app opens directly on the AI Dashboard (Priority: P1)

As the operator, I want the app to open on the AI Dashboard every time, without a toggle and without a second dashboard. That way there is one place to look, and one implementation to maintain.

**Why this priority**: This is the core of the request.

**Independent Test**:
1. Open the app in a fresh browser and in a browser that had the classic dashboard selected before.
2. Both show the AI Dashboard immediately.
3. No dashboard toggle or classic project detail is reachable.

**Acceptance Scenarios**:

1. **Given** any browser, including one that previously chose the classic dashboard, **When** the app is opened, **Then** the AI Dashboard is shown.
2. **Given** the app is open, **When** the operator looks for a way to switch dashboards, **Then** there is no toggle and no classic dashboard view.
3. **Given** the AI Dashboard is shown, **When** "Sync now" is used, **Then** the data is synced and the AI Dashboard is refreshed, as today.

---

### User Story 2 - Behaviour when the AI is unavailable (Priority: P1)

As the operator, I want a clear and still useful screen when the AI (host Ollama) is unreachable or the model is missing. The classic dashboard no longer exists as a fallback.

**Why this priority**: Without a fallback, an AI outage would otherwise leave the app without a dashboard.

**Independent Test**: Stop the host Ollama (or configure a missing model), open the app, and check what is shown and what still works.

**Acceptance Scenarios**:

1. **Given** the AI is unreachable or the model is missing, **When** the app is opened, **Then** the main area shows a status message with the reason ("Host Ollama unreachable" or "AI model not installed"). The message says that the dashboard will appear automatically once the AI is available. No substitute layout is shown.
2. **Given** the AI comes back online, **When** the next status check succeeds, **Then** the AI Dashboard is generated without a manual reload.
3. **Given** the AI is unavailable, **When** the operator opens "€ Turnover" or uses "Sync now", **Then** both work as today.

---

### User Story 3 - Navigation without the classic project list and detail (Priority: P2)

As the operator, I want the sidebar project list and the classic project detail removed. I still need to reach the timesheet per project, and clicking a project in the turnover overview must lead somewhere meaningful.

**Why this priority**: Removing the classic dashboard must not cut off the timesheet export or the navigation from the turnover overview.

**Independent Test**:
1. Starting from the AI Dashboard, open the full timesheet of an hourly project.
2. Click a project in the "€ Turnover" overview.
3. Check what happens in each case.

**Acceptance Scenarios**:

1. **Given** the classic dashboard is removed, **When** the operator looks at the sidebar, **Then** it contains only the app title, "Sync now", "€ Turnover" and the theme selector. There is no project list and no dashboard toggle.
2. **Given** an hourly project with a timesheet summary block on the AI Dashboard (the default declaration includes one per project), **When** the operator clicks that block, **Then** the full timesheet (copy / CSV) opens for that project and month, in one click from the main screen.
3. **Given** the "€ Turnover" overview is open, **When** the operator clicks a project row, **Then** the AI Dashboard is shown.
4. **Given** "€ Turnover" is open, **When** the operator clicks "€ Turnover" again, **Then** the AI Dashboard is shown again, as today.
5. **Given** an in-progress lump-sum project, **When** the AI Dashboard is shown with the default declaration, **Then** it shows the lump-sum card (`LUMP SUM` badge, agreed lump sum, invoiced, earned %), followed by the project's turnover per year, and no burndown or timesheet block. This is the same information the classic project detail showed.

---

### Edge Cases

- **Stored dashboard preference**: a browser with the stored preference "classic" opens the AI Dashboard; the stale preference is ignored and removed.
- **Bookmarks and old links**: no route or bookmark leads to a blank page.
- **Empty AI response**: if the AI returns an empty or unusable layout, the existing error handling applies ("no layout"), with a retry.
- **Projects not on the AI Dashboard**: closed or archived projects, or projects the declaration doesn't include, are no longer visible on any dashboard, and their timesheet is not reachable from the UI. Their turnover stays visible in "€ Turnover". This is accepted; the operator controls coverage via the declaration.
- **Timesheet while the AI is unavailable**: without a generated dashboard there are no timesheet blocks, so the full timesheet is not reachable until the AI is back. This is accepted (Q1 and Q2 → A).
- **Lump-sum projects**: the classic sidebar card and detail are removed without loss. The AI lump-sum card and the project-turnover block (feature 008) show agreed, invoiced, earned % and the turnover per year. Closed lump-sum projects are handled like any closed project: they are not on the dashboard, and their turnover stays in "€ Turnover".
- **Theme**: the theme selection is unchanged and still applies to the AI Dashboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST show the AI Dashboard as its only dashboard, on every start and in every browser.
- **FR-002**: The dashboard toggle and the classic dashboard MUST be removed: the sidebar project list, and the project detail with stats, burndown chart and Timesheet button.
- **FR-003**: A stored "classic" dashboard preference MUST be ignored and cleared.
- **FR-004**: "Sync now", "€ Turnover", the full Timesheet window (copy / CSV) and the theme selector MUST keep working.
- **FR-005**: When the AI is unavailable, the main area MUST show a status message naming the reason ("Host Ollama unreachable" / "AI model not installed") instead of a dashboard. The AI Dashboard MUST appear automatically, without a reload, when the AI is back.
- **FR-006**: The full timesheet of an hourly project MUST open with one click on its timesheet summary block on the AI Dashboard.
- **FR-007**: A click on a project row in "€ Turnover" MUST show the AI Dashboard. The sidebar MUST contain only the title, "Sync now", "€ Turnover" and the theme selector.
- **FR-008**: Code, styles and documentation that served only the classic dashboard MUST be removed. The README MUST describe the AI Dashboard as the only dashboard.
- **FR-009**: Data, sync, API endpoints and the figures shown on the AI Dashboard MUST be unchanged. This feature only removes a view.

### Key Entities

- **Dashboard preference**: a per-browser stored choice "classic | AI". It is obsolete after this feature and gets cleared.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of app starts show the AI Dashboard, including browsers that previously chose the classic dashboard.
- **SC-002**: No screen, control or link leads to the classic dashboard (checked by walking every sidebar control and every clickable element of the turnover overview).
- **SC-003**: With the default declaration, the full timesheet of every in-progress hourly project opens with 1 click from the main screen.
- **SC-004**: With the AI unavailable, the app shows the status message with the reason within 3 seconds, and "€ Turnover" and "Sync now" work. Within 30 seconds of the AI becoming available, the dashboard appears without a reload.
- **SC-005**: All figures on the AI Dashboard and in "€ Turnover" are identical before and after the change.
- **SC-006**: A future change to a building block (e.g. the project card) needs to be made in one place only.

## Assumptions

- The operator is the only user; there are no other users relying on the classic dashboard.
- The AI Dashboard's building blocks (feature 002, extended in 007 and 008) cover the information previously shown in the classic project detail. The burndown chart and the turnover exist as blocks; hour stats are shown on the project card.
- The host Ollama is usually available. During outages a status message is enough; no substitute layout is needed.
- API endpoints used only by the classic view, such as the per-project burndown, stay, because the AI blocks use them too.
