# Feature Specification: Full-Width Dashboard with Menu, Closed Projects and Lump-Sum Marking

**Feature Branch**: `010-header-menu-closed-projects`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description (German, translated): "We no longer need the Turnover button if the year switching is integrated into the AI Dashboard. Sync now and Theme should move into a hamburger menu. That makes the whole left area unnecessary. A toggle would be good so closed projects can be shown too. The turnover view already includes them, the burndowns don't. Since lump-sum projects are now only contained in the turnover overview, they should be recognisable as such there."

## Context

After feature 009, the AI Dashboard is the only dashboard. The left sidebar holds only four things:
- the title;
- "↻ Sync now";
- "€ Turnover", which switches to a separate turnover overview with ‹ / › year navigation;
- the theme selector.

The AI Dashboard's own turnover overview block shows a single, fixed year. The dashboard shows only in-progress projects. Closed projects appear in the turnover figures but have no card or burndown anywhere.

This feature:
- removes the sidebar, so the dashboard uses the full width;
- moves Sync now and the theme into a menu;
- replaces the separate turnover view with year switching inside the AI Dashboard's turnover overview;
- adds a toggle that also shows closed projects;
- marks lump-sum projects in the turnover overview.

## Clarifications

### Session 2026-11-26

- Q: Which blocks does a closed project show when the toggle is on? → A: The project card and the burndown only. There is no timesheet summary. Lump-sum projects show their card and project turnover.
- Q: How are lump-sum projects marked in the turnover overview? → A: A `LUMP SUM` badge next to the project name, and nothing else.
- Q: What does the main area show when the AI is unavailable? → A: The status message, plus the turnover overview with year switching below it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Full-width dashboard with a menu (Priority: P1)

As the operator, I want the left sidebar gone and its remaining actions ("Sync now", theme) in a compact menu, so the AI Dashboard uses the whole screen width.

**Why this priority**: This is the layout change everything else builds on.

**Independent Test**:
1. Open the app. There is no left sidebar; a header shows the app title and a menu button (☰).
2. Open the menu. It offers "Sync now" and the theme selection.
3. Use both.

**Acceptance Scenarios**:

1. **Given** the app is opened, **When** the page is shown, **Then** there is no left sidebar and the AI Dashboard spans the full width below a header with the title and a menu button.
2. **Given** the menu is opened, **When** the operator chooses "Sync now", **Then** the data is synced, the menu closes, the progress is visible while syncing, and the AI Dashboard refreshes afterwards, as today.
3. **Given** the menu is opened, **When** the operator picks a theme, **Then** the theme applies immediately and is remembered, as today.
4. **Given** the menu is open, **When** the operator clicks outside it or presses Escape, **Then** it closes without any action.
5. **Given** a sync fails, **When** the error occurs, **Then** the error message is shown above the dashboard, as today.

---

### User Story 2 - Year switching in the AI Dashboard's turnover overview (Priority: P1)

As the operator, I want to switch years directly in the turnover overview on the AI Dashboard, so I no longer need a separate turnover view and button.

**Why this priority**: Removing the "€ Turnover" button and view is only acceptable when its year switching is available on the dashboard.

**Independent Test**:
1. On the AI Dashboard, use ‹ / › in the turnover overview block.
2. The figures for the previous and next years are shown, identical to the former turnover view.

**Acceptance Scenarios**:

1. **Given** the AI Dashboard shows the turnover overview for the current year, **When** the operator clicks ‹, **Then** the previous year's turnover is shown in the same block, without regenerating the dashboard.
2. **Given** the current year is shown, **When** the operator looks at ›, **Then** it is disabled (no future years), as in the former turnover view.
3. **Given** the operator has switched to another year, **When** the dashboard is regenerated (reload or sync), **Then** the block starts again at its default year (the declared year, otherwise the current year).
4. **Given** the app is open, **When** the operator looks for "€ Turnover", **Then** there is no such button and no separate turnover view.

---

### User Story 3 - Show closed projects on demand (Priority: P2)

As the operator, I want a toggle to also show closed projects on the AI Dashboard, so I can look at their figures. Today they only appear in the turnover totals.

**Why this priority**: Useful for retrospectives and follow-up invoicing, but not needed every day.

**Independent Test**:
1. Turn on "Show closed projects".
2. Closed projects appear on the AI Dashboard after the in-progress ones.
3. Turn it off; they disappear.
4. Reload; the choice is kept.

**Acceptance Scenarios**:

1. **Given** the toggle is off (default), **When** the AI Dashboard is shown, **Then** it shows in-progress projects only, as today.
2. **Given** the toggle is turned on, **When** the AI Dashboard is shown, **Then** closed projects also appear, after all in-progress projects, each marked as closed, each with its project card and burndown chart only (no timesheet summary).
3. **Given** the toggle is on, **When** the page is reloaded, **Then** it is still on.
4. **Given** lump-sum projects are closed, **When** the toggle is on, **Then** they are shown with their lump-sum card and project turnover (feature 008 rules), never with burndown or timesheet.

---

### User Story 4 - Lump-sum projects recognisable in the turnover overview (Priority: P2)

As the operator, I want lump-sum projects marked in the turnover overview, so I can tell them apart from hourly projects at a glance.

**Why this priority**: Small and independent, but it improves how the yearly turnover reads.

**Independent Test**: Open the turnover overview for a year with invoices for a lump-sum project; that row is marked as lump sum. Hourly rows are unmarked.

**Acceptance Scenarios**:

1. **Given** a year with invoices for a lump-sum project, **When** the turnover overview is shown, **Then** that project's row carries a `LUMP SUM` badge next to the project name. No other figures are added.
2. **Given** an hourly project row, **When** the overview is shown, **Then** it looks as today.
3. **Given** a lump-sum marking, **When** the totals are shown, **Then** the amounts and the total are unchanged to the cent.

---

### Edge Cases

- **AI unavailable**: without "€ Turnover", the turnover overview would only be reachable through the AI Dashboard. When the AI is unavailable, the main area shows the status message, plus the turnover overview with year switching below it. That overview works without the AI, so turnover stays visible during an outage. When the AI is back, the generated dashboard replaces both.
- **Declaration without a turnover overview**: if the operator's declaration does not ask for a turnover overview, the AI Dashboard has no year switching (it remains available while the AI is unavailable). This is accepted; the default declaration includes it.
- **Year switching range**: ‹ goes back as far as invoice years exist; at the oldest year with data it shows "No invoices in <year>", as in the former view.
- **Theme in the menu**: the theme selection keeps all existing themes and the stored choice.
- **Narrow windows**: the header and menu stay usable at narrow widths; the menu does not cover the page permanently.
- **Closed projects without any data**: closed projects with no hours and no invoices are still shown when the toggle is on.
- **Many closed projects**: generation may take longer when the toggle is on; the existing loading and streaming indicators apply.
- **Turnover row click**: with the separate turnover view gone, project rows in the turnover overview are not links any more.
- **Bookmarks / stored state**: no stored state refers to the removed turnover view; opening the app always shows the AI Dashboard.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The left sidebar MUST be removed. The AI Dashboard MUST use the full content width below a header.
- **FR-002**: The header MUST show the app title and a menu button. The menu MUST offer "Sync now" (with visible progress while syncing) and the theme selection. It closes on selection, on outside click and on Escape.
- **FR-003**: The "€ Turnover" button and the separate turnover view MUST be removed.
- **FR-004**: The AI Dashboard's turnover overview MUST offer ‹ / › year switching with the same figures, limits and empty states as the former turnover view. Switching MUST NOT regenerate the dashboard. Each regeneration MUST start at the block's default year.
- **FR-005**: There MUST be a "Show closed projects" toggle, off by default, remembered per browser. When it is on, closed projects MUST appear on the AI Dashboard after all in-progress projects, marked as closed, with the project card and burndown chart only (no timesheet summary).
- **FR-005a**: While the AI is unavailable, the main area MUST show the status message and, below it, the turnover overview with year switching (FR-004). It MUST switch to the generated dashboard automatically when the AI is back.
- **FR-006**: Lump-sum projects MUST keep the feature 008 rules in every view, including when closed (no burndown, no timesheet).
- **FR-007**: The turnover overview MUST mark lump-sum projects with a `LUMP SUM` badge next to the project name. Amounts and totals MUST stay unchanged.
- **FR-008**: Sync errors MUST be shown above the dashboard.
- **FR-009**: The README MUST describe the header menu, the year switching, the closed-projects toggle and the lump-sum marking, and drop the sidebar and "€ Turnover" references.

### Key Entities

- **Closed-projects preference**: a per-browser on/off choice, default off.
- **Turnover overview year**: the year shown in the turnover overview block. It is temporary and resets on each regeneration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The AI Dashboard uses the full window width; no left sidebar is shown at any time.
- **SC-002**: "Sync now" and the theme are reachable in 2 clicks (menu, then action).
- **SC-003**: Switching the turnover year shows the new year's figures within 1 second, without regenerating the dashboard. The figures equal those of the former turnover view to the cent.
- **SC-004**: With the toggle on, 100 % of closed projects appear on the dashboard. With it off, 0 % do.
- **SC-005**: 100 % of lump-sum rows in the turnover overview are marked, and 0 % of hourly rows. Yearly totals are unchanged to the cent.
- **SC-006**: The toggle choice survives a page reload in the same browser.
- **SC-007**: With the AI unavailable, the turnover overview, including year switching, is visible within 3 seconds of opening the app.

## Assumptions

- The operator is the only user; one browser preference is enough.
- The toggle sits in the header menu together with Sync now and the theme.
- "Closed" means the existing status rule (deadline or actual end date passed), as today.
- The default declaration keeps its turnover overview at the top. The year switching lives in that block, not in a separate control.
- Turning the toggle on or off does not regenerate the AI Dashboard. Closed projects appear in a fixed section below the generated layout, built from the same blocks, so the switch is instant and every closed project is shown (plan R1).
- The per-project turnover block (ProjectTurnover) is unchanged.
- The data, sync and turnover counting rules are unchanged.
