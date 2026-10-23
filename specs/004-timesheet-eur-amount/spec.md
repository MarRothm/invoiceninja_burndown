# Feature Specification: EUR Equivalent of Timesheet Totals

**Feature Branch**: `004-timesheet-eur-amount`

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "add timesheet total's EUR equivalent based on hour rate"

**Builds on**: [003-timesheet-monthly-export](../003-timesheet-monthly-export/spec.md) — the monthly timesheet overlay with daily totals, weekly subtotals and month total.

## Clarifications

### Session 2026-10-22

- Q: Where does the hour rate come from? → A: The project's task rate synchronised from InvoiceNinja; no manual entry or override.
- Q: Should EUR amounts be included in Copy month / CSV? → A: No — display-only; copy and CSV formats stay unchanged.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the month total as a EUR amount (Priority: P1)

As the operator, when I open a project's monthly timesheet I want to see, next to the month
total in hours, what that time is worth in EUR at the project's hour rate, so I can check
or prepare the amount to invoice or report without calculating it by hand.

**Why this priority**: This is the request itself — one amount per month answers "what is
this month worth?" and is the figure transferred to invoicing/reporting.

**Independent Test**: Open the timesheet of a project with a known hour rate and known
bookings for a month; verify the displayed EUR amount equals month hours × hour rate,
rounded to cents.

**Acceptance Scenarios**:

1. **Given** a project with an hour rate of 95.00 EUR and 37.5 h booked in September 2026,
   **When** the operator opens the September timesheet, **Then** the month total shows
   37.50 h and an EUR equivalent of 3,562.50 €.
2. **Given** a month with no bookings, **When** the timesheet is shown, **Then** the EUR
   equivalent shows 0.00 €.
3. **Given** the operator switches the hours format between decimal and hours:minutes,
   **When** the timesheet re-renders, **Then** the EUR amount does not change.
4. **Given** the operator navigates to another month, **When** the list updates, **Then**
   the EUR amount updates to that month's total.
5. **Given** the timesheet is open, **Then** the hour rate used for the calculation is
   visible next to the EUR amount (e.g. "@ 95.00 €/h").

---

### User Story 2 - See EUR equivalents of weekly subtotals (Priority: P2)

As the operator, I want each weekly subtotal to also show its EUR equivalent, because I
often report or bill per week.

**Why this priority**: Useful refinement of Story 1 for weekly reporting; the month amount
alone already delivers the core value.

**Independent Test**: For a month with bookings in several weeks, verify every weekly
subtotal row shows hours × rate in EUR, including the edge weeks labelled "incl. days from
other month".

**Acceptance Scenarios**:

1. **Given** a week with 12.25 h and a rate of 80.00 €/h, **When** the timesheet is shown,
   **Then** that week's subtotal row shows 980.00 €.
2. **Given** an edge week (incl. days from other month), **When** the timesheet is shown,
   **Then** its EUR amount covers the full Monday–Sunday week, consistent with its hours.

---

### User Story 3 - Handle projects without an hour rate (Priority: P2)

As the operator, when a project has no hour rate available, I want the timesheet to tell me
clearly instead of showing a misleading 0 €.

**Why this priority**: Prevents wrong amounts from being transferred; small effort.

**Independent Test**: Open the timesheet of a project without a rate; verify no EUR amount
is shown and a hint explains that no hour rate is set.

**Acceptance Scenarios**:

1. **Given** a project without an hour rate, **When** the timesheet is opened, **Then** the
   EUR fields show "—" with a hint "No hour rate set", and hours are shown as before.

---

### Edge Cases

- **No hour rate / rate 0**: no EUR amount shown ("—" with hint); never shown as 0.00 €
  unless the hours are 0 and a rate exists.
- **Rate changed in InvoiceNinja**: the timesheet uses the rate as of the last sync for all
  months (no historical rates); the amount for past months may therefore change after a
  rate change.
- **Rounding**: the EUR amount is computed from unrounded hours and rounded to 2 decimals
  (cents) only for display, so it may differ by a cent from "displayed hours × rate".
- **Large amounts**: thousands separators are shown so amounts stay readable.
- **Project currency is not EUR**: out of scope; the rate is treated as EUR (see
  Assumptions).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The timesheet MUST show the EUR equivalent of the month total, computed as
  month total hours × the project's hour rate.
- **FR-002**: The hour rate MUST be the project's task rate as maintained in InvoiceNinja
  and synchronised with the project data; the timesheet MUST NOT offer a way to enter or
  override the rate.
- **FR-003**: The hour rate used MUST be displayed alongside the EUR amount.
- **FR-004**: Each weekly subtotal MUST show its EUR equivalent (hours of the full
  Monday–Sunday week × hour rate).
- **FR-005**: EUR amounts MUST be calculated from unrounded hours and displayed with
  exactly 2 decimals, a thousands separator and the € symbol.
- **FR-006**: EUR amounts MUST be independent of the selected hours display format.
- **FR-007**: If no hour rate is available (missing or 0), the timesheet MUST show "—" with
  the hint "No hour rate set" instead of an EUR amount, and all hour values MUST remain
  unaffected.
- **FR-008**: EUR amounts MUST be display-only; "Copy month", single-value copy and the CSV
  download MUST remain unchanged (one row per day with date and hours, no amount column or
  total line).
- **FR-009**: The timesheet MUST remain read-only; showing EUR amounts MUST NOT change any
  data in InvoiceNinja.
- **FR-010**: EUR amounts MUST follow the existing timesheet theme and visual design.

### Key Entities

- **Hour Rate**: Amount in EUR per booked hour for one project; attribute of the project
  (value, source).
- **EUR Equivalent**: Derived amount = hours × hour rate, attached to the month total and to
  each weekly subtotal; not stored.
- **Timesheet / Weekly Subtotal** (existing, from 003): gain an EUR equivalent attribute.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For a tested sample month, 100% of displayed EUR amounts (month and weekly)
  equal hours × rate rounded to the cent.
- **SC-002**: The operator can read the monthly EUR amount within 1 click of the main
  screen (opening the timesheet), without any manual calculation.
- **SC-003**: Opening or switching months in the timesheet remains within 2 seconds
  (no noticeable slowdown compared to the timesheet without EUR amounts).
- **SC-004**: For projects without an hour rate, 0 cases show a misleading 0.00 € amount.

## Assumptions

- If a project has no task rate in InvoiceNinja (missing or 0), it counts as "no hour rate"
  (FR-007); it is not inherited from the client or company defaults.
- The hour rate is expressed in EUR; no currency conversion is performed.
- One hour rate per project applies to all its time entries (no per-task, per-user or
  time-dependent rates).
- The rate is the current one as of the last sync; historical rate changes are not tracked.
- Daily rows do not show an EUR amount on screen (only weekly subtotals and the month
  total) to keep the daily list compact.
- Amounts are net values; taxes/VAT are not applied.
- German/European number formatting is not required; formatting follows the existing
  dashboard number style with the € symbol.
