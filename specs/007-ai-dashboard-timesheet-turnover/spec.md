# Feature Specification: Timesheet and Turnover in the AI Dashboard

**Feature Branch**: `007-ai-dashboard-timesheet-turnover`

**Created**: 2026-11-24

**Status**: Draft

**Input**: User description: "Das AI Dashboard muss um Timesheet und Turnover erweitert werden. Wie wird die AI Dashboard Zusammensetzung definiert? Gibt es ein md-file dafür?" (The AI Dashboard must be extended with Timesheet and Turnover. How is the AI Dashboard composition defined? Is there an md file for it?)

## Context

The AI Dashboard is composed by the AI from a plain-language **declaration** (a Markdown file maintained by the operator). Today the declaration can only use three building blocks per project: a project card (with status badge and progress), and a burndown chart. Timesheet (hours booked per day/month, with EUR equivalent) and Turnover (invoiced / paid / open per year) already exist in the classic dashboard but cannot be placed on the AI Dashboard.

This feature adds Timesheet and Turnover building blocks to the AI Dashboard, so the operator can describe in the declaration where and for which projects they appear, the same way as project cards and burndown charts today.

## Clarifications

### Session 2026-11-24

- Context (user): Today the AI Dashboard must be reloaded manually. After the first burndown chart, generation continues, but the display is not updated.
- Q: Should this feature also fix the live display update during generation? → A: Yes, it is in scope. Every block appears as soon as it is generated, and the finished dashboard is shown without a manual reload.
- Q: How does the timesheet appear on the AI Dashboard? → A: As a month summary per project (hours, EUR, hour rate). Activating it opens the full existing timesheet. No daily or weekly rows on the AI Dashboard.
- Q: What does Turnover show on the AI Dashboard? → A: Both building blocks are available: Project Turnover (all years with invoices) and Turnover Overview (cross-project, one year). The default declaration uses the cross-project Turnover Overview; Project Turnover appears only when the declaration asks for it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turnover on the AI Dashboard (Priority: P1)

As the operator, I want to write in the declaration that turnover should be shown, and then see invoiced, paid and open amounts on the AI Dashboard, so I can see the financial state next to the budget burndown without switching views.

**Why this priority**: Turnover is the information most often looked at together with budget consumption ("how much is used, how much is invoiced/paid").

**Independent Test**: Add one sentence about turnover to the declaration, reload the AI Dashboard and compare the amounts shown with the existing Turnover view for the same project/year.

**Acceptance Scenarios**:

1. **Given** the declaration says to show the turnover per project, **When** the AI Dashboard is generated, **Then** each listed project shows its turnover per year (invoiced, paid, open), with the same amounts as the classic project turnover view.
2. **Given** the declaration says to show a turnover overview for the current year, **When** the AI Dashboard is generated, **Then** a cross-project overview for the current year is shown, with the same totals as the existing Turnover overview.
3. **Given** a project has no invoices, **When** its turnover block is shown, **Then** it states "no invoices" instead of an empty or broken block.

---

### User Story 2 - Timesheet on the AI Dashboard (Priority: P2)

As the operator, I want to write in the declaration that the timesheet should be shown, and then see the booked hours of the month (and their EUR equivalent) per project on the AI Dashboard.

**Why this priority**: Useful for a monthly overview, but the detailed transfer work (copy per day, CSV) still happens in the existing timesheet view.

**Independent Test**: Add one sentence about the timesheet to the declaration, reload the AI Dashboard and compare the hours and EUR amount with the existing timesheet for the same project and month.

**Acceptance Scenarios**:

1. **Given** the declaration says to show the timesheet for the current month, **When** the AI Dashboard is generated, **Then** each listed project shows a timesheet summary for the current month whose month total (hours and EUR) equals the existing timesheet view.
2. **Given** a timesheet block on the AI Dashboard, **When** the operator activates it, **Then** the full existing timesheet for that project and month opens (with copy and CSV functions).
3. **Given** a project has no time booked in the month, **When** its timesheet block is shown, **Then** it shows 0 hours instead of an empty or broken block.

---

### User Story 3 - Understand and edit the dashboard composition (Priority: P3)

As the operator, I want to know which building blocks I can use in the declaration and how to phrase them, so I can change the AI Dashboard without reading code.

**Why this priority**: The declaration only helps if the operator knows what is possible; today the available blocks are only visible in code.

**Independent Test**: Following only the documentation, write a declaration that uses all building blocks; the generated dashboard contains each of them.

**Acceptance Scenarios**:

1. **Given** the operator reads the documentation, **When** they look for the dashboard composition, **Then** they find where the declaration file lives, how to change it at runtime without a rebuild, and the full list of building blocks with one example sentence each.
2. **Given** the default declaration shipped with the stack, **When** a fresh stack generates the AI Dashboard, **Then** it shows the cross-project Turnover Overview for the current year, plus a project card, burndown chart and Timesheet Summary for the current month per active project. No Project Turnover blocks are shown.

---

### User Story 4 - Dashboard builds up live without manual reload (Priority: P1)

As the operator, I want to see each block appear on the AI Dashboard as soon as the AI has generated it, and see the complete dashboard at the end, without reloading the page.

**Why this priority**: Today only the first block is shown during generation and the rest needs a manual reload. With the new, longer dashboards this would get worse, so the dashboard would look broken.

**Independent Test**: Clear the cached layout (change the declaration), open the AI Dashboard and watch generation without touching the page: the number of visible blocks grows during generation, and at the end all blocks are shown.

**Acceptance Scenarios**:

1. **Given** a dashboard is being generated, **When** the AI has finished the second project's blocks, **Then** the blocks of both projects are visible, without a reload.
2. **Given** generation has finished, **When** the operator looks at the dashboard without reloading, **Then** every block that the declaration asks for is shown, the same as after a manual reload.
3. **Given** the operator changes the declaration, **When** the dashboard is regenerated, **Then** it builds up live in the same way.

---

### Edge Cases

- **Declaration does not mention timesheet or turnover**: The dashboard looks exactly as it does today (no new blocks appear unasked).
- **AI references an unknown project**: The block shows a short "project not found" notice; the rest of the dashboard renders.
- **Turnover for a year without invoices** or **timesheet for a month in the future**: Blocks show zero values / "no invoices", not an error.
- **No hour rate for a project**: The timesheet block shows "—" for the EUR amount, consistent with the existing timesheet.
- **Data not yet synced**: Blocks show the data of the last sync, like the rest of the dashboard.
- **Generation ends early or stalls**: The blocks already generated stay visible; the existing "generation seems stuck" prompt and retry still apply.
- **Generation time**: Adding blocks makes the AI output longer; the dashboard must still be generated within the existing time limit for a typical number of active projects.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The AI Dashboard MUST offer a **Project Turnover** building block that shows invoiced, paid and open amounts per year for one project.
- **FR-002**: The AI Dashboard MUST offer a **Turnover Overview** building block that shows the cross-project turnover for one year (default: current year).
- **FR-003**: The AI Dashboard MUST offer a **Timesheet Summary** building block that shows, for one project and one month (default: current month), the month total in hours and its EUR equivalent including the hour rate used.
- **FR-004**: The Timesheet Summary MUST give access to the full existing timesheet for that project and month (including copy and CSV functions).
- **FR-005**: All amounts and hours shown in the new blocks MUST be identical to the existing Timesheet and Turnover views for the same project and period.
- **FR-006**: The operator MUST be able to control, in plain language in the declaration, whether the new blocks appear, for which projects, and in which order relative to project cards and burndown charts.
- **FR-007**: When the declaration names a specific month or year, the blocks MUST use it; otherwise the current month / current year.
- **FR-008**: If the declaration does not mention timesheet or turnover, the generated dashboard MUST NOT contain the new blocks.
- **FR-009**: The default declaration shipped with the stack MUST be extended so the new blocks are visible out of the box: one cross-project Turnover Overview for the current year, and a Timesheet Summary for the current month per active project. It MUST NOT include Project Turnover blocks; the operator adds them through the declaration when needed.
- **FR-010**: Changing the declaration at runtime (without a rebuild) MUST continue to work and MUST regenerate the dashboard with the new composition.
- **FR-011**: A block that cannot load its data MUST show a short notice inside the block and MUST NOT break the rest of the dashboard.
- **FR-012**: The new blocks MUST be read-only and MUST follow the existing visual design of the dashboard.
- **FR-013**: The documentation MUST describe the declaration file (location, runtime override, reload behaviour) and list every building block with an example sentence.
- **FR-014**: During generation, each block MUST appear on the dashboard as soon as it has been generated; the number of visible blocks MUST grow until generation is complete.
- **FR-015**: When generation is complete, the dashboard MUST show all generated blocks without a manual reload, identical to what a reload would show.

### Key Entities

- **Declaration**: Plain-language Markdown text by the operator that describes which blocks appear, for which projects, in which order, and for which period.
- **Building block**: A unit the AI can place on the dashboard. Existing: Project Card, Burndown Chart. New: Project Turnover, Turnover Overview, Timesheet Summary.
- **Period**: The month (Timesheet Summary) or year (Turnover blocks) a block refers to; defaults to the current one.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of checked projects and periods, the turnover and timesheet numbers on the AI Dashboard match the existing views exactly.
- **SC-002**: An operator can add turnover or timesheet to the AI Dashboard by editing one sentence in the declaration, without code changes or rebuild, in under 2 minutes.
- **SC-003**: With the default declaration and up to 10 active projects, the AI Dashboard is fully generated within the existing generation time limit.
- **SC-004**: Following only the documentation, an operator writes a declaration that uses every building block on the first attempt.
- **SC-005**: A declaration without timesheet/turnover produces the same dashboard as before this feature.
- **SC-006**: In 100% of test generations, the finished dashboard is complete without a manual reload, and at least one further block appears after the first one before generation ends.

## Assumptions

- The existing Timesheet and Turnover data and calculation rules (features 003, 004, 005) are reused unchanged; this feature only makes them available on the AI Dashboard.
- Amounts are gross EUR, as in the existing Turnover view; hours and EUR rules follow the existing timesheet.
- The Timesheet Summary on the AI Dashboard shows only the month total (no daily or weekly rows, per clarification); the daily detail stays in the existing timesheet view, which the block opens.
- Project Turnover shows all years with invoices (as in the existing project turnover table); the Turnover Overview shows one year. By default, only the Turnover Overview is used (per clarification).
- The AI model stays `qwen2.5:7b` on the host Ollama (feature 006).
- The classic (non-AI) dashboard is unchanged.
