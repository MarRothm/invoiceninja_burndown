# Feature Specification: Project Turnover by Year

**Feature Branch**: `005-project-turnover-by-year`

**Created**: 2026-11-11

**Status**: Draft

**Input**: User description: "Add turnover info per project split by year e.g. 2026 invoiced amount / paid amount"

## Clarifications

### Session 2026-11-11

- Q: Net or gross amounts? → A: Gross (incl. VAT), matching InvoiceNinja invoice and payment amounts.
- Q: Which year does a payment count in? → A: The year of the invoice it pays (invoice view), so paid + open = invoiced per year.
- Q: Where is turnover shown? → A: Per-year table in the selected project's detail view, plus a cross-project overview for a chosen year.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See invoiced and paid amounts per year for a project (Priority: P1)

As the operator, when I look at a project I want to see, for each calendar year, how much
was invoiced and how much of that was paid, so I know the project's turnover per year
without opening InvoiceNinja reports.

**Why this priority**: This is the request itself; one small table per project answers
"what did this project bring in, and in which year?".

**Independent Test**: Pick a project with known invoices and payments across two years;
verify each year's invoiced and paid amounts equal the corresponding sums in InvoiceNinja.

**Acceptance Scenarios**:

1. **Given** a project with invoices dated 2025-11-20 (1,000.00 €) and 2026-02-10
   (2,500.00 €), **When** the operator views the project, **Then** the turnover shows
   2025: invoiced 1,000.00 € and 2026: invoiced 2,500.00 €.
2. **Given** the 2026 invoice of 2,500.00 € was paid with 1,500.00 €, **When** the operator
   views the project, **Then** 2026 shows paid 1,500.00 € and an open amount of 1,000.00 €.
3. **Given** an invoice dated 2025-12-15 (800.00 €) paid on 2026-01-10, **When** the
   operator views the project, **Then** the 800.00 € counts as paid in 2025 (the invoice
   year), and 2026 is unaffected.
4. **Given** a project with invoices in several years, **Then** years are listed newest
   first, plus a total row across all years.
5. **Given** a project without any invoices, **Then** the turnover section shows
   "No invoices yet" instead of a table of zeros.
6. **Given** the data was synchronised, **Then** the section shows the time of the last sync.

---

### User Story 2 - Compare turnover across projects for one year (Priority: P2)

As the operator, I want a quick view of the selected year's invoiced and paid amounts for
all listed projects, so I can see which projects carried the year. I open it from a
"Turnover" entry in the sidebar, which switches the main area to the overview.

**Why this priority**: Builds on Story 1's per-project figures; valuable for year-end review
but not required for the per-project view.

**Independent Test**: Select 2026 and verify that each project's figures match its
per-project view and the sum row equals the sum of all projects.

**Acceptance Scenarios**:

1. **Given** three projects with 2026 invoices, **When** the operator opens the overview for
   2026, **Then** each project shows its 2026 invoiced/paid/open amounts and a total row
   sums them.
2. **Given** a project without 2026 invoices, **When** the overview for 2026 is shown,
   **Then** that project is not listed.
3. **Given** the overview is opened, **Then** it defaults to the current year, and the
   operator can switch to any year that has invoices.
4. **Given** a project row in the overview, **When** the operator selects it, **Then** that
   project's detail view opens with its per-year table.

---

### Edge Cases

- **Draft invoices**: excluded — not yet invoiced.
- **Cancelled / reversed / deleted invoices**: excluded from invoiced and paid amounts.
- **Partial payments**: counted with the amount actually paid.
- **Payment in a later year than the invoice** (e.g. invoiced Dec 2025, paid Jan 2026):
  counted as paid in the invoice year (2025); the 2025 open amount drops after the payment
  is synced.
- **Refunds**: reduce the paid amount of the year of the refunded invoice.
- **One payment covering invoices from different years**: split by the amount applied to
  each invoice.
- **Payments not applied to any invoice** (unapplied credit): not counted.
- **Credit notes**: out of scope for this feature (see Assumptions).
- **Invoices not linked to a project**: not counted for any project.
- **Archived/closed projects**: follow the existing dashboard visibility rules.
- **Large amounts**: thousands separators, 2 decimals, € symbol (same format as the
  timesheet EUR amounts).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST show, per project, one row per calendar year that has at least one
  invoice for that project, with invoiced amount, paid amount and open amount
  (invoiced − paid for invoices of that year).
- **FR-002**: Invoiced amounts MUST be attributed to the year of the invoice date.
- **FR-003**: All amounts MUST be gross (including VAT), as invoiced and paid in InvoiceNinja.
- **FR-004**: Paid amounts MUST be attributed to the year of the invoice they pay (not the
  payment date), using the amount applied to each invoice net of refunds, so that
  paid + open = invoiced for every year.
- **FR-005**: Draft, cancelled, reversed and deleted invoices MUST be excluded.
- **FR-006**: Years MUST be listed newest first, followed by a total row across all years.
- **FR-007**: A project without invoices MUST show "No invoices yet".
- **FR-008**: Amounts MUST be formatted with 2 decimals, thousands separator and €, matching
  the timesheet EUR amounts.
- **FR-009**: Turnover data MUST come from InvoiceNinja via the regular synchronisation; the
  dashboard MUST NOT allow entering or editing invoices or payments, and MUST show the last
  sync time.
- **FR-010**: The per-year table MUST be shown in the selected project's detail view.
- **FR-011**: The display MUST follow the existing theme and design tokens. The sidebar
  "Turnover" entry MUST be available in both legacy and AI dashboard mode.
- **FR-012**: A cross-project overview MUST list, for one selected year, every project with
  invoices in that year with its invoiced, paid and open amounts, sorted by invoiced amount
  (highest first), followed by a total row; projects without invoices in that year MUST NOT
  be listed.
- **FR-013**: The overview MUST be reachable from a "Turnover" entry in the sidebar, default
  to the current year, and offer every year that has invoices; selecting a project row MUST
  open that project's detail view.
- **FR-014**: For the same project and year, the overview and the per-project table MUST
  show identical amounts.

### Key Entities

- **Invoice** (new, synchronised): belongs to a project (and client); attributes: number,
  date, amount, status.
- **Payment** (new, synchronised): amount paid against one or more invoices; attributes:
  date, amount, refunded amount.
- **Yearly Turnover** (derived): project, year, invoiced amount, paid amount, open amount.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a tested sample of projects, 100% of yearly invoiced and paid amounts match
  InvoiceNinja (as of the last sync) to the cent.
- **SC-002**: The operator sees a project's yearly turnover within 1 click of selecting the
  project, without opening InvoiceNinja.
- **SC-003**: Turnover appears within 2 seconds of selecting a project.
- **SC-004**: New or paid invoices appear in the dashboard after the next regular sync
  without manual steps.
- **SC-005**: For any year, the overview's total row equals the sum of the listed projects
  to the cent.

## Assumptions

- All invoices are in EUR; no currency conversion.
- "Open" is the invoice balance as of the last sync; overdue status is not shown.
- "Paid" follows InvoiceNinja's "paid to date" per invoice, so credits applied to an
  invoice count as paid.
- The overview covers projects visible under the existing dashboard rules (archived/deleted
  projects filtered out); in AI dashboard mode the per-project table appears wherever that
  mode shows a single project's detail.
- Calendar years (January–December), not fiscal years.
- An invoice belongs to a project via its project link in InvoiceNinja; invoices only
  linked through tasks are not counted separately.
- Credit notes and quotes are out of scope.
- Single operator use; no additional access control (same as the existing dashboard).
- Turnover is independent of the burndown hours and of the timesheet (no link to the
  task rate from feature 004).
