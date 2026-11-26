# Feature Specification: Own Fixed Scale for Daily Hours in the Burndown

**Feature Branch**: `011-burndown-daily-hours-axis`

**Created**: 2026-11-26

**Status**: Draft

**Input**: User description (German, translated): "The burndown also shows the hours booked each day at the bottom. Depending on the y-axis scale, the values are sometimes easier, sometimes harder to read. A separate, fixed y-scale would make sense."

## Context

Each project's burndown chart shows the remaining hours as lines (ideal, actual, forecast). It also shows the hours booked per day as bars along the bottom. Bars and lines share one vertical scale, and that scale follows the project's budget.
- With a 40 h budget, an 8 h day is a clearly visible bar.
- With a 600 h budget, the same 8 h day is a sliver of a few pixels.

The same day therefore looks very different from project to project, and the daily values are hard to read on large projects.

This feature gives the daily bars their own scale. That scale is fixed and the same in every burndown chart, independent of the budget. The lines keep their current scale.

## Clarifications

### Session 2026-11-26

- Q: What is the fixed maximum of the daily-hours scale? → A: 10 h. The scale runs from 0 h to 10 h.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Readable daily hours on every project (Priority: P1)

As the operator, I want the daily booked hours in the burndown on their own fixed scale. A given number of hours should then look the same in every project's chart, and I can read the values whatever the budget.

**Why this priority**: This is the whole feature.

**Independent Test**:
1. Open the burndown of a small-budget project and of a large-budget project that both have an 8 h day.
2. The 8 h bar has the same height in both charts.
3. Its value can be read from a labelled daily-hours scale.

**Acceptance Scenarios**:

1. **Given** any burndown chart, **When** it is shown, **Then** the daily bars use their own labelled scale, separate from the remaining-hours scale. That scale runs from 0 h to 10 h.
2. **Given** two projects with very different budgets, **When** both burndowns show a day with the same booked hours, **Then** the bars have the same height.
3. **Given** a burndown chart, **When** it is shown, **Then** the daily bars stay in the lower part of the chart, as today, and do not cover the remaining-hours lines in the upper part.
4. **Given** a burndown chart, **When** it is shown, **Then** the ideal, actual and forecast lines, the "Today" marker and the remaining-hours scale are unchanged.
5. **Given** the operator hovers over a day, **When** the tooltip appears, **Then** it shows the exact booked hours for that day, as today.

---

### User Story 2 - Days above the scale maximum stay recognisable (Priority: P2)

As the operator, I want days with more hours than the scale maximum to be recognisable as such. A fixed scale must not hide or misstate a long day.

**Why this priority**: Such days are rare, but a silently clipped bar would misinform.

**Independent Test**: Open a burndown containing a day above the scale maximum. The bar reaches the top of the daily scale, it is visibly marked as exceeding it, and the tooltip shows the real value.

**Acceptance Scenarios**:

1. **Given** a day with more booked hours than the scale maximum, **When** the chart is shown, **Then** its bar is drawn at the scale maximum and visibly marked as exceeding it.
2. **Given** such a day, **When** the operator hovers over it, **Then** the tooltip shows the real booked hours, not the capped value.
3. **Given** days at or below the maximum, **When** the chart is shown, **Then** they carry no such marking.

---

### Edge Cases

- **No hours booked yet**: the daily scale is still shown with its fixed range, and there are no bars.
- **Fractional hours** (e.g. 0.25 h): small values stay visible as bars, at least as visible as today.
- **Hours on weekends or after the deadline**: drawn on the same fixed scale, as on any other day.
- **Lump-sum projects**: they have no burndown (feature 008) and are not affected.
- **Closed projects** (feature 010): their burndown uses the same fixed daily scale.
- **Themes**: the daily scale and the overflow marking use the active theme's colours and stay readable in every theme.
- **Narrow windows**: the second scale must not squeeze the chart until it is unreadable. The labels stay legible at the chart sizes in use today.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The daily booked-hours bars MUST use their own vertical scale, separate from the remaining-hours scale.
- **FR-002**: The daily scale MUST be fixed at 0 h to 10 h. Its range MUST be the same in every burndown chart, whatever the project's budget, booked hours or date range.
- **FR-003**: The daily scale MUST be labelled in hours, so the bar values can be read without the tooltip.
- **FR-004**: The daily bars MUST stay in the lower part of the chart and MUST NOT cover the remaining-hours lines.
- **FR-005**: Days above the scale maximum MUST be drawn at the maximum and visibly marked as exceeding it. The tooltip MUST show the real value.
- **FR-006**: The remaining-hours lines, their scale, the "Today" marker and the tooltip contents MUST stay as they are today.
- **FR-007**: The change MUST apply to every burndown chart in the app, both in-progress and closed projects.
- **FR-008**: The README MUST describe the separate daily-hours scale and the marking for days above the maximum.

### Key Entities

- **Daily booked hours**: the hours booked on one project on one calendar day. They already exist; only how they are shown changes.
- **Daily scale**: the fixed vertical range for the daily bars, from 0 h to 10 h, the same in every chart.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The same number of daily hours is drawn at the same bar height in 100 % of burndown charts, whatever the budget.
- **SC-002**: A 1 h day can be told apart from an empty day in every burndown chart, including projects with budgets of 500 h and more.
- **SC-003**: The operator can read a day's booked hours to the nearest hour from the daily scale, without the tooltip.
- **SC-004**: 100 % of days above the maximum are marked, and 0 % of days at or below it are.
- **SC-005**: The remaining-hours lines and their values are unchanged compared with before the feature.

## Assumptions

- One operator books the hours, so a single fixed daily range fits all projects.
- The daily scale is shown as a second, labelled scale on the opposite side from the remaining-hours scale.
- The daily bars use at most the lower part of the chart height (roughly the lower third), so the lines stay readable above them.
- The data and how daily hours are counted are unchanged. This is a display change only.
- The scale maximum is not configurable in the UI (YAGNI). It is a fixed value.
