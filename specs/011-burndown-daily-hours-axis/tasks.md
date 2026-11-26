# Tasks: Own Fixed Scale for Daily Hours in the Burndown

**Input**: Design documents from `specs/011-burndown-daily-hours-axis/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui.md, quickstart.md

**Tests**: No automated tests are requested.
- The frontend has no test runner (plan R6, YAGNI).
- The API is unchanged; its existing suite must stay green.
- Verification is `npm run build` plus the quickstart browser checks.

**Organization**: tasks are grouped by user story. Every code task touches `frontend/src/components/BurndownChart.jsx`, so all tasks run sequentially (no [P]), apart from the README.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Confirm a clean baseline on branch `011-burndown-daily-hours-axis`:
  - `cd frontend && npm run build` succeeds;
  - `cd api && npm test` is green;
  - note the current rendering of `frontend/src/components/BurndownChart.jsx` (single left axis, bars on `dataKey="logged"`).

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T002 Add the constants and derived data in `frontend/src/components/BurndownChart.jsx`:
  - module constants `DAILY_MAX_HOURS = 10` and `DAILY_DOMAIN = [0, DAILY_MAX_HOURS * 3]`, with comments pointing to spec Q1 and plan R1;
  - import `useMemo`;
  - inside the component, `const chartData = useMemo(() => (data ?? []).map(d => ({ ...d, daily: Math.min(d.logged ?? 0, DAILY_MAX_HOURS), over: (d.logged ?? 0) > DAILY_MAX_HOURS })), [data])`;
  - pass `chartData` instead of `data` to `ComposedChart`.

**Checkpoint**: the chart renders exactly as before; only the derived fields exist.

---

## Phase 3: User Story 1 - Readable daily hours on every project (Priority: P1) 🎯 MVP

**Goal**: the daily bars use their own fixed 0–10 h scale on the right. 10 h sits at one third of the plot height and is equal in every chart. The lines are unchanged.

**Independent Test**:
1. Compare the burndowns of a small-budget and a ≥ 500 h project.
2. The right axis shows `0h / 5h / 10h`, and equal hours give equal bar heights.
3. The bars stay in the lower third; the lines, left axis and "Today" marker are unchanged (quickstart checks 1–3).

### Implementation for User Story 1

- [X] T003 [US1] Add the daily axis in `frontend/src/components/BurndownChart.jsx`, after the existing left `YAxis`:
  ```jsx
  <YAxis yAxisId="daily" orientation="right" domain={DAILY_DOMAIN} ticks={[0, 5, 10]} allowDataOverflow tick={{ fill: 'var(--muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}h`} />
  ```
  - Leave the left `YAxis`, `CartesianGrid`, the `Line`s and the `ReferenceLine` on the default axis id (plan R4).
  - Change the chart margin `right: 8` → `right: 0`.
- [X] T004 [US1] Bind the bars to the daily axis in `frontend/src/components/BurndownChart.jsx`:
  - on the `Bar`, set `yAxisId="daily"` and `dataKey="daily"`;
  - keep `name="Daily Logged"`, `fill={barFill}`, `stroke={barStroke}`, `strokeWidth={1}` and `radius={[2, 2, 0, 0]}`.
- [X] T005 [US1] Show the real hours in the tooltip in `frontend/src/components/BurndownChart.jsx`. In `CustomTooltip`, compute the displayed value as `p.dataKey === 'daily' ? p.payload.logged : p.value` (same `Nh` / `—` formatting). This keeps the daily value exact for every day (US1 scenario 5).
- [X] T006 [US1] Run `cd frontend && npm run build`. Then do quickstart checks 1–3 in the browser:
  - the fixed scale;
  - equal heights across budgets, with a 1 h day visible on a large project;
  - lines and left axis unchanged, bars not covering the lines.

**Checkpoint**: US1 is complete and shippable on its own. Days above 10 h are capped silently until US2.

---

## Phase 4: User Story 2 - Days above the scale maximum stay recognisable (Priority: P2)

**Goal**: days above 10 h are drawn at 10 h with a ▲ marker, and the tooltip shows the real hours.

**Independent Test**: in a burndown with a day above 10 h, the capped bar shows ▲ and the tooltip shows the real hours. No ▲ appears on days ≤ 10 h (quickstart check 4).

### Implementation for User Story 2

- [X] T007 [US2] Add the overflow marker in `frontend/src/components/BurndownChart.jsx`:
  - import `LabelList` from `recharts`;
  - define `OverMarker({ x, y, width, value })`. It returns `null` unless `value` is true. Otherwise it returns `<text x={x + width / 2} y={y - 4} textAnchor="middle" fill="var(--text)" fontSize={10}>▲</text>`.
  - Add `<LabelList dataKey="over" content={OverMarker} />` as a child of the `Bar`.
- [X] T008 [US2] Run `cd frontend && npm run build`. Then do quickstart check 4 in the browser:
  - a day above 10 h shows a capped bar with ▲, and its tooltip shows the real hours (via T005);
  - no ▲ appears on any day ≤ 10 h.

**Checkpoint**: US1 and US2 are complete.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [X] T009 [P] Update the "Burndown Logic" section in `README.md` (FR-008). Add the bullet: "**Daily hours**: bars on their own fixed scale (right axis, 0–10 h, lower third of the chart), equal in every project; days above 10 h are capped and marked ▲, the tooltip shows the real value".
- [X] T010 Check every rendering path of the chart (FR-007, SC-001):
  - grep `frontend/src` for `BurndownChart` and confirm that `frontend/src/components/ai/BurndownChart.ai.jsx` and the closed-projects section in `frontend/src/components/ai/AIDashboard.jsx` both render the shared `BurndownChart`, with no local axis overrides;
  - do quickstart check 5 (closed projects).
- [ ] T011 Run the full validation:
  - `cd api && npm test` is green (unchanged suite);
  - `cd frontend && npm run build` succeeds;
  - `docker compose build frontend` succeeds;
  - quickstart checks 6–7 (all themes, narrow window about 400 px).

---

## Dependencies & Execution Order

- **Setup (T001)** → **Foundational (T002)** → **US1 (T003–T006)** → **US2 (T007–T008)** → **Polish (T009–T011)**.
- US2 depends on US1. The ▲ marker needs the capped `daily` bar on the daily axis, and the real-value tooltip comes from T005.
- All code tasks edit the same file, so they run sequentially.
- T009 (README) can run in parallel with any task after T002.

## Parallel Example

```text
# While working through T003–T008 in BurndownChart.jsx:
Task: "T009 [P] Update the Burndown Logic section in README.md"
```

## Implementation Strategy

- **MVP**: Phases 1–3 (US1). This already fixes the readability problem; only days above 10 h are capped without a marker.
- **Increment**: Phase 4 (US2) adds the marker. Phase 5 adds the README and the final validation.
- **Deploy**: after merge to `master`, GitHub Actions builds the `burndown-frontend` image. Redeploy manually in Portainer (Stacks → burndown → Update the stack).

## Implementation Notes (2026-11-26)

- T006 and T008 were verified with a headless server render of the chart at 600×360. Bars of 8 h, 1 h and 12.5 h:
  - land at identical pixel positions for a 40 h and a 600 h budget (SC-001);
  - the capped 12.5 h day reaches about one third of the plot height and is the only bar with ▲;
  - the right axis shows `0h 5h 10h`, and the left axis is unchanged (`0h…40h` / `0h…600h`).
- T010: the grep confirms that the only renderer is `BurndownChartAI` → `BurndownChart`, which the AI layout and the closed-projects section both use. There are no local axis overrides.
- T011 is open until the browser checks are confirmed: the visual look, all themes, the narrow window, and ▲ / the tooltip on real data.
  - API tests: 199 passed.
  - `npm run build`: passed.
  - Frontend image: `docker build frontend` passed. `docker compose build` has no build services, because the stack pulls the ghcr images.
