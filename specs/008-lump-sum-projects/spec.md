# Feature Specification: Lump-Sum Projects

**Feature Branch**: `008-lump-sum-projects`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "not all projects are billed per time spent. Some pay lump sums for reached goals. For later a burndown and timesheet are useless. Turnover is relevant to such projects as well. In Invoiceninja such projects can be identified by the project's keyword "Pauschalabrechnung"."

## Context

Today every project is treated as billed by time: it shows booked hours against a budget, a burndown chart, a progress percentage and a timesheet with an EUR amount. Some projects are billed by lump sums when agreed goals are reached (milestone billing). For those, hours against a budget, the burndown and the timesheet carry no meaning and are misleading (for example, a lump-sum project with no hour budget shows "0 %" progress). Their turnover (invoiced / paid / open) is still relevant.

In InvoiceNinja these projects carry the project tag (German UI: "Stichwort") **"Pauschalabrechnung"**. This feature recognises them and shows them as lump-sum projects in every view: classic dashboard, project detail and AI Dashboard.

## Clarifications

### Session 2026-11-25

- Q: In which InvoiceNinja field is "Pauschalabrechnung" maintained? → A: As an InvoiceNinja **tag** (Settings → Tags / "Stichworte") of type "Project", assigned to the project.
- Q: What does the project card show instead of hours and progress? → A: The **agreed lump sum** (in the project currency) and the **lump sum earned in %** (share of the agreed lump sum already earned).
- Q: What counts as "earned"? → A: **Invoiced** (not paid).
- Q: Where is the agreed lump sum maintained in InvoiceNinja? → A: In project **custom field 3** (label "Vereinbarte Pauschale"). The currency of the lump sum is in project **custom field 4** (label "Projektwährung").

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Lump-sum projects show agreed and earned lump sum instead of hours (Priority: P1)

As the operator, I want projects tagged "Pauschalabrechnung" to show the agreed lump sum and how much of it is earned (in %), plus their turnover, instead of hours, burndown and hour progress. That way the dashboard shows the information that matters for them and nothing misleading.

**Why this priority**: This is the core of the request. Without it, lump-sum projects show meaningless figures.

**Independent Test**: Tag one project in InvoiceNinja with "Pauschalabrechnung", sync, then open the classic dashboard and that project's detail view.

**Acceptance Scenarios**:

1. **Given** a project is tagged "Pauschalabrechnung", **When** the dashboard is shown after a sync, **Then** its project card shows a "Lump sum" marker, the agreed lump sum in the project currency and the lump sum earned in % (with a bar of the same percentage), and no hour budget, booked/remaining hours or hour progress.
2. **Given** a lump-sum project with an agreed lump sum of 10,000 EUR and 4,000 EUR earned, **When** its card is shown, **Then** it shows "10,000.00 €" agreed and "40 %" earned.
3. **Given** a lump-sum project is opened, **When** its detail view is shown, **Then** it shows no burndown chart and no timesheet action, and shows the project's turnover per year exactly as for hourly projects.
4. **Given** a project without the tag, **When** any view is shown, **Then** it looks and behaves exactly as today.
5. **Given** the tag is added to or removed from a project in InvoiceNinja, **When** the next sync has run, **Then** the project is shown in its new mode without any other action.

---

### User Story 2 - Turnover overviews include lump-sum projects (Priority: P1)

As the operator, I want lump-sum projects included in the cross-project turnover overview with their invoiced, paid and open amounts, so the yearly totals stay complete.

**Why this priority**: The turnover totals would be wrong if lump-sum projects were dropped.

**Independent Test**: Compare the yearly turnover overview totals before and after marking a project as lump sum. They must be identical.

**Acceptance Scenarios**:

1. **Given** a lump-sum project has invoices in a year, **When** the turnover overview for that year is shown, **Then** the project is listed and counted in the total, the same as before this feature.

---

### User Story 3 - AI Dashboard respects lump-sum projects (Priority: P2)

As the operator, I want the AI Dashboard to skip burndown and timesheet blocks for lump-sum projects and to show their turnover instead, without me having to name these projects in the declaration.

**Why this priority**: The AI Dashboard is generated from a general declaration ("for each project show a burndown and timesheet"), which would otherwise produce meaningless blocks for lump-sum projects.

**Independent Test**: Generate the AI Dashboard with the default declaration while one project is marked as lump sum; check that project's blocks.

**Acceptance Scenarios**:

1. **Given** the declaration asks for a burndown and timesheet per project, **When** the AI Dashboard is generated, **Then** lump-sum projects get no burndown and no timesheet block. Instead, their project card is followed by the project's turnover.
2. **Given** an AI Dashboard layout is cached and a project's billing mode changes, **When** the next sync completes, **Then** the next AI Dashboard view reflects the new mode.
3. **Given** the declaration explicitly asks for a lump-sum project's burndown, **When** the AI Dashboard is generated, **Then** the block is still not shown for that project (hours are meaningless for lump-sum projects).

---

### Edge Cases

- **Tag spelling**: the tag name is matched case-insensitively, ignoring surrounding whitespace ("pauschalabrechnung", " Pauschalabrechnung ").
- **Other tags**: a project may carry further tags; only the "Pauschalabrechnung" tag matters.
- **No agreed lump sum**: if no agreed lump sum is set, the card shows "Lump sum not set" instead of an amount and a percentage, never "0 %" or an error.
- **Project currency**: a lump sum of 8,000 with "CHF" in field 4 is shown as "CHF 8,000.00". An unknown currency code is shown as entered next to the amount.
- **Amount format**: the amount in field 3 may be entered with German or English separators ("10.000,00", "10000", "10,000.00"); all are read as ten thousand.
- **Over-earned**: if more than the agreed lump sum is earned, the percentage is shown above 100 % (e.g. "110 %"), like hour budgets overrun today.
- **Hours booked anyway**: hours on a lump-sum project stay stored but are not shown as budget consumption or progress.
- **Hour budget set anyway**: an hour budget on a lump-sum project is ignored for display.
- **Status**: a lump-sum project's status ("in progress" / "closed") is determined the same way as today (deadline / actual end date).
- **Ordering**: where projects are ordered "by budget consumed", lump-sum projects come after the hourly projects, ordered by earned % (highest first).
- **No invoices**: a lump-sum project without invoices shows "no invoices yet" in its turnover.
- **Timesheet export**: the timesheet export is not offered for lump-sum projects.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST classify each project as **lump sum** if the project carries the InvoiceNinja tag "Pauschalabrechnung" (tag of type "Project"). All other projects are **hourly**, as today.
- **FR-002**: The classification MUST be refreshed with every project sync. No setting in this application is needed.
- **FR-003**: For lump-sum projects, the classic dashboard and the project detail MUST NOT show an hour budget, booked/remaining hours, a progress percentage, a progress bar, a burndown chart or a timesheet action.
- **FR-004**: Lump-sum projects MUST show a visible "Lump sum" marker, the **agreed lump sum** (in the project currency) and the **lump sum earned in %** (earned ÷ agreed, rounded to whole percent) on their project card and in the project detail.
- **FR-004a**: The agreed lump sum MUST be taken from the project's custom field 3 ("Vereinbarte Pauschale"), refreshed with every sync. Its currency MUST be taken from custom field 4 ("Projektwährung", a currency code such as "EUR" or "CHF"); if field 4 is empty, the currency is EUR.
- **FR-004c**: The agreed lump sum MUST be displayed in the project currency. An unparseable amount in field 3 MUST be treated as "Lump sum not set".
- **FR-004b**: The earned amount MUST be the amount invoiced for the project (all years, excluding cancelled/deleted invoices), consistent with "invoiced" in the turnover view.
- **FR-005**: The project detail of a lump-sum project MUST show its turnover per year (invoiced / paid / open), with the same amounts as the existing project turnover view.
- **FR-006**: Turnover overviews MUST include lump-sum projects unchanged; totals MUST be identical to those before this feature.
- **FR-007**: The AI Dashboard MUST NOT render a burndown or timesheet block for a lump-sum project, regardless of the declaration. If the declaration asks for a burndown or timesheet per project, lump-sum projects MUST show their project turnover in place of those blocks. Their project card on the AI Dashboard MUST show the agreed lump sum and earned % (FR-004).
- **FR-008**: A cached AI Dashboard layout MUST NOT survive a change of any project's billing mode.
- **FR-009**: Hourly projects MUST behave exactly as today in all views.
- **FR-010**: The README MUST describe the tag, where to set it and the agreed lump sum in InvoiceNinja, and what changes for lump-sum projects.

### Key Entities

- **Project**: an existing entity, extended by its **billing mode** (`hourly` | `lump sum`), derived from the tag "Pauschalabrechnung" at every sync, and for lump-sum projects by the **agreed lump sum** (custom field 3, may be unset), its **project currency** (custom field 4, default EUR) and the derived **earned %** (invoiced ÷ agreed).
- **Turnover**: an existing entity (invoiced / paid / open per project and year). It is unchanged and applies to both billing modes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After one sync, 100 % of projects carrying the tag are shown as lump sum, and 0 % of projects without it are.
- **SC-002**: No lump-sum project shows a burndown chart, hour progress or timesheet action in any view (classic dashboard, project detail, AI Dashboard).
- **SC-003**: Yearly turnover totals are identical before and after this feature, to the cent.
- **SC-004**: A change of the tag or the agreed lump sum in InvoiceNinja is reflected in all views after the next sync, with no further action.
- **SC-005**: Hourly projects show unchanged figures in all views (regression check on at least two projects).
- **SC-006**: The earned % on a lump-sum card equals invoiced ÷ agreed lump sum, to the whole percent, checked on at least one project.

## Assumptions

- The tag is assigned manually per project in InvoiceNinja by the operator; there is no other source for the billing mode.
- The InvoiceNinja version in use exposes project tags through its API (to be verified in planning).
- "Earned" means invoiced, not paid; the paid amount remains visible in the turnover.
- Invoices of a lump-sum project are issued in the project currency, so earned % needs no currency conversion. Turnover views keep showing amounts as today.
- Custom field 2 keeps its meaning (actual end date); custom fields 3 and 4 are only evaluated for lump-sum projects.
- A project is either hourly or lump sum. There are no mixed projects.
- Turnover data already covers all projects, regardless of billing mode, so no new data is needed from InvoiceNinja beyond the tag and the agreed lump sum.
- Hours booked on lump-sum projects may still exist in InvoiceNinja. They are kept but not displayed.
- Milestone tracking (which goals are reached and which are still open) is out of scope.
