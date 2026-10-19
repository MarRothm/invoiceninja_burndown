# Feature Specification: Monthly Timesheet for Transfer to External Systems

**Feature Branch**: `003-timesheet-monthly-export`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "add timesheet functionality so that I can easily transfer project time per day into other systems. Timesheet scope on per month. For every day one sum of booked time shall be shown. Suggest 3 options where to add this on the GUI."

## Clarifications

### Session 2026-10-19

- Q: How are weekly subtotals computed for weeks that cross a month boundary? → A: Full Monday–Sunday week including days of the neighbouring month; such edge-week subtotals are marked "incl. days from other month" and are not expected to sum to the month total.
- Q: Do weekly subtotals change copy/export? → A: No — subtotals are display-only; Copy month, single-value copy and CSV download stay one row per day without subtotal rows.
- Q: Are the neighbouring month's days of edge weeks shown? → A: Yes — shown as greyed-out, read-only, non-copyable rows; excluded from month total, Copy month and CSV.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View a monthly timesheet with one daily total (Priority: P1)

As the operator, I open the timesheet for a project, pick a month, and see one row per
calendar day of that month showing the total booked time for that day, weekly
subtotals per Monday–Sunday week, plus a month total.
I use this list to type the values into another system (e.g. a customer portal or an
employer's time-tracking tool) day by day, typically once per week.

**Why this priority**: This is the core value — today the per-day sums have to be added up
manually from individual InvoiceNinja tasks. A readable daily list alone already removes
that manual work.

**Independent Test**: Select a project with known time entries in a given month, open the
timesheet for that month, and verify each day's total equals the sum of that day's
completed time entries, the month total equals the sum of the month's days, and each weekly
subtotal equals the sum of its Monday–Sunday days.

**Acceptance Scenarios**:

1. **Given** a project with three completed time entries on 2026-09-03 (1.5 h, 2 h, 0.5 h),
   **When** the operator opens the September 2026 timesheet, **Then** the row for
   3 September shows 4.00 h.
2. **Given** a month with days on which nothing was booked, **When** the timesheet is shown,
   **Then** those days still appear with a total of 0 (visually de-emphasised), so every day
   of the month is always listed.
3. **Given** the timesheet is open, **When** the operator moves to the previous or next
   month, **Then** the list updates to that month without leaving the timesheet.
4. **Given** the timesheet is opened for the first time in a session, **Then** it defaults
   to the current month.
5. **Given** a month, **When** the timesheet is shown, **Then** a month total is displayed
   that equals the sum of all daily totals.
6. **Given** September 2026 (1 Sep is a Tuesday), **When** the timesheet is shown, **Then**
   a subtotal row follows each Sunday (6, 13, 20, 27 Sep) and one follows the trailing week
   28 Sep – 04 Oct, each equal to the sum of its seven days.
7. **Given** the week 28 Sep – 04 Oct with 2 h on 29 Sep and 3 h on 02 Oct, **When** the
   September timesheet is shown, **Then** 01–04 Oct appear as greyed-out rows, the week
   subtotal shows 5.00 h labelled "incl. days from other month", and the month total
   includes only the 2 h.
8. **Given** August 2026 (31 Aug is a Monday), **When** the timesheet is shown, **Then** the
   first week starts on Mon 27 Jul with greyed-out July rows, and the last week
   31 Aug – 06 Sep shows greyed-out September rows.

---

### User Story 2 - Copy or export the timesheet for transfer (Priority: P2)

As the operator, I want to copy the whole month (date + hours) to the clipboard or download
it as a file, so I can paste it into a spreadsheet or import it into another system instead
of retyping every value.

**Why this priority**: Turns "easy to read" into "easy to transfer". Depends on Story 1's
data but delivers its own measurable time saving.

**Independent Test**: Open a month's timesheet, use "Copy", paste into a spreadsheet, and
verify one row per day with date and hours in separate columns; use "Download" and open the
file in a spreadsheet tool with the same result.

**Acceptance Scenarios**:

1. **Given** a displayed month, **When** the operator activates "Copy", **Then** the
   clipboard contains one line per day with the date and the daily total separated so that
   pasting into a spreadsheet produces two columns, and a confirmation is shown.
2. **Given** a displayed month, **When** the operator activates "Download", **Then** a file
   named after the project and month (e.g. `timesheet_<project>_2026-09.csv`) is downloaded
   containing a header row and one row per day.
3. **Given** the operator copies a single day's value, **When** they click/tap that day's
   total, **Then** only that value is copied (for field-by-field entry in web forms).

---

### User Story 3 - Choose the time display format (Priority: P3)

As the operator, I want to switch the hours display between decimal hours (e.g. `1.75`)
and hours:minutes (e.g. `1:45`), because target systems differ in which format they accept.

**Why this priority**: Convenience; decimal hours cover most targets, so this is optional
for an MVP.

**Independent Test**: Toggle the format and verify both the display and copied/exported
values follow the selected format; reload the page and verify the choice is remembered.

**Acceptance Scenarios**:

1. **Given** decimal format is selected, **When** a day totals 105 minutes, **Then** it is
   shown and exported as `1.75`.
2. **Given** hours:minutes format is selected, **When** a day totals 105 minutes, **Then**
   it is shown and exported as `1:45`.
3. **Given** the operator selected a format, **When** they return later on the same
   browser, **Then** the same format is preselected.

---

### Edge Cases

- **Month without any bookings**: all days shown with 0, month total 0, copy/export still
  works (no error, no empty file).
- **Future month / current month**: days after today are shown with 0 (no special error);
  the operator may navigate forward at most to the current month.
- **Month outside project lifetime** (before start date or after close): timesheet still
  renders with zeros; no blocking message.
- **Time entries not yet completed** (running timers): excluded from totals, consistent with
  the burndown calculation.
- **Entries deleted or changed in InvoiceNinja**: reflected after the next sync; the
  timesheet shows the data as of the last sync and displays the last-sync time.
- **Multiple entries spanning midnight**: attributed to the date the entry is recorded
  under in the synchronised data (no splitting across days).
- **Weeks crossing a month boundary**: the subtotal includes the days of the neighbouring month (full week), is labelled "incl. days from other month", and the sum of weekly subtotals therefore may differ from the month total.
- **Weekends**: shown like other days but visually distinguishable, so the operator can
  quickly skip them when typing values.
- **Clipboard not available** (browser permission denied / insecure context): show a
  clear message and offer the download as fallback.

## GUI Placement Options *(requested by user)*

Three candidate placements in the existing interface (sidebar with project list +
main area showing the selected project's header, stat tiles and burndown chart):

| Option | Placement | Pros | Cons |
|--------|-----------|------|------|
| **A — Section in project detail view** | A "Timesheet" panel below the burndown chart (or a "Burndown / Timesheet" tab switch above the chart) in the main area of the selected project. | Zero new navigation; reuses the existing project selection; natural "drill-down" from burndown to daily detail. | Per-project only; page gets long if shown below the chart; not visible in AI dashboard mode. |
| **B — Dedicated "Timesheet" view in the sidebar** | A new navigation entry next to the AI Dashboard toggle that switches the main area to a full-width timesheet view with month picker and project selector (single project or "all projects" with one column per project). | Room for a month grid across several projects; independent of dashboard mode; best for a monthly "transfer everything" routine. | Largest change to navigation; requires its own project selector. |
| **C — Action on project card / header opening an overlay** | A small "Timesheet" icon on each project card in the sidebar and in the project header; opens a modal/side drawer with month navigation and Copy/Download buttons. | Reachable in one click from any project and from both dashboard modes; does not disturb the existing layout; focused transfer task. | Overlay limits space (single project); one more icon on compact cards. |

**Recommendation**: Option C for the MVP (smallest layout impact, available in both legacy
and AI mode, matches the "quickly copy and go" use case), with Option B as a later
extension if a multi-project monthly overview becomes necessary.

**Chosen placement**: Option C — a "Timesheet" action on each project card in the sidebar and in the project header, opening an overlay (modal/side drawer) for that project. Available in both legacy and AI dashboard modes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a timesheet scoped to exactly one calendar month at a time.
- **FR-002**: The timesheet MUST cover the time entries of exactly one project — the project whose timesheet action was used. Cross-project totals are out of scope.
- **FR-003**: System MUST show one row for every calendar day of the selected month (plus the neighbouring-month days of edge weeks per FR-020), each with a single sum of booked time for that day, including days with zero.
- **FR-004**: Daily sums MUST include only completed time entries, using the same inclusion rules as the burndown calculation (no double counting, running timers excluded).
- **FR-005**: System MUST show a month total equal to the sum of all daily totals of the selected month.
- **FR-017**: System MUST show a weekly subtotal after the last day (Sunday) of each Monday–Sunday week that has at least one day in the selected month, including a trailing partial week at month end.
- **FR-018**: Each weekly subtotal MUST cover the full Monday–Sunday week, including days that belong to the previous or next month; when a week extends beyond the selected month, its subtotal MUST be labelled "incl. days from other month" (with the full date range, e.g. "28 Sep – 04 Oct").
- **FR-019**: Weekly subtotals are display-only; they MUST NOT appear in the copied month text or the downloaded file, which remain exactly one row per day of the selected month.
- **FR-020**: For weeks crossing the month boundary, the days belonging to the neighbouring month MUST be shown as greyed-out, read-only rows (no single-value copy) so the edge-week subtotal is traceable; they MUST be excluded from the month total, Copy month and the CSV download.
- **FR-006**: Users MUST be able to navigate to previous and next months; the default is the current month; navigation beyond the current month is not offered.
- **FR-007**: Users MUST be able to copy the full month (date + daily total, one line per day) to the clipboard in a format that pastes into spreadsheets as two columns.
- **FR-008**: Users MUST be able to download the month as a comma-separated file with a header row, one row per day, named with project and month.
- **FR-009**: Users MUST be able to copy a single day's total with one click.
- **FR-010**: Users MUST be able to switch between decimal hours (2 decimals) and hours:minutes display; the choice MUST apply to display, copy and download and MUST be remembered on the same browser.
- **FR-011**: Dates MUST be shown and exported in an unambiguous ISO format (YYYY-MM-DD) in exports; on screen, the weekday MUST be shown alongside the date and weekends MUST be visually distinguishable.
- **FR-012**: The timesheet MUST display the time of the last data synchronisation so the operator knows how current the totals are.
- **FR-013**: The timesheet MUST be read-only; it MUST NOT create, change or delete any time entries (InvoiceNinja remains the single source of truth).
- **FR-014**: The timesheet MUST follow the existing theme (light/dark and colour themes) and visual design of the dashboard.
- **FR-015**: The timesheet MUST be opened via a "Timesheet" action on each project card in the sidebar and in the selected project's header, and MUST appear as an overlay that can be closed without losing the current dashboard state.
- **FR-016**: The timesheet action MUST be available in both the legacy and the AI dashboard mode.

### Key Entities

- **Timesheet (month view)**: Represents one calendar month for one project; attributes: month, project, list of daily totals, weekly subtotals, month total, last-sync time.
- **Weekly Subtotal**: One Monday–Sunday week (identified by its Monday date and ISO week number) with the summed booked time of all seven days, a date range, and a flag whether it includes days outside the selected month.
- **Daily Total**: One calendar date within the month and the summed booked time of all completed time entries for that date within the project.
- **Time Entry** (existing): An individual booked time record synchronised from InvoiceNinja, belonging to a project, with a date, a duration and a status.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The operator can get a complete month of daily totals into a spreadsheet or another system's import in under 1 minute (open timesheet → copy/download → paste).
- **SC-002**: 100% of daily totals match the sum of the corresponding completed time entries in InvoiceNinja (as of the last sync) for a tested sample month.
- **SC-003**: The timesheet for any month appears within 2 seconds of opening it or switching months.
- **SC-004**: Pasting the copied month into a common spreadsheet tool produces exactly as many rows as the month has days, with date and hours in separate columns, without manual cleanup.
- **SC-005**: The timesheet of any listed project is reachable from the main screen in 1 click.
- **SC-006**: For any tested month, 100% of weekly subtotals equal the sum of the booked time of their seven days (including neighbouring-month days), so the operator can transfer one week without manual addition.

## Assumptions

- Weeks start on Monday and end on Sunday (ISO 8601); weekly subtotals follow the selected display format (decimal or hours:minutes).
- Single operator use (same as the existing dashboard); no additional authentication or per-user filtering is needed.
- Time data comes from the already-synchronised time entries; no new connection to InvoiceNinja is required.
- "Booked time" means completed time entries; the status rules match the burndown chart.
- Archived/deleted projects follow the existing visibility rules of the dashboard (filtered out); closed projects that are still listed can open their timesheet.
- A multi-project monthly overview (placement option B) is out of scope for this feature and may follow later.
- Hours are rounded to 2 decimals (decimal format) or whole minutes (hours:minutes format) per day; the month total is computed from unrounded values.
- CSV is the export format; direct API push into specific third-party systems is out of scope for this feature.
- Dates are taken as recorded in the synchronised data; no time zone conversion is performed.
- Desktop browser is the primary target; the timesheet must remain usable on narrow screens but no dedicated mobile layout is required.
