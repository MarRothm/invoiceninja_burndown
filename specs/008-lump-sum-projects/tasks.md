# Tasks: Lump-Sum Projects

**Input**: Design documents from `specs/008-lump-sum-projects/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/projects-and-ai.md, quickstart.md

**Tests**:
- The API gets Vitest tests for the lump-sum helpers, the project mapping and the AI rules, written before their implementation. The constitution requires `test.yml` to stay green.
- `frontend/` has no test runner, so frontend work is checked with `npm run build` and the quickstart.

**Organization**: Phases follow the user stories, in this order:
- US1 (P1): lump-sum card and detail;
- US2 (P1): turnover overviews stay complete;
- US3 (P2): AI Dashboard.

All paths are relative to the repo root.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks).
- **[Story]**: The user story the task belongs to.

---

## Phase 1: Setup

- [X] T001 Run `cd api && npm test` and `cd frontend && npm run build`. Record the baseline (number of passing API tests, build OK) at the end of this file under `## Validation Log`.
- [X] T002 Verify that tags reach the database (quickstart "Verify tags reach the database").
  - If production is not reachable from the workstation, check the shape against the InvoiceNinja source finding in research R1 and move the live check to T026.
  - Record the result in the Validation Log.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the pure lump-sum helpers and the additive `GET /api/projects` fields, which every story uses.

### Tests (write first; they must fail before T006/T008)

- [X] T003 [P] Create `api/tests/lump-sum.test.js` with these cases for `api/src/services/lump-sum.js`:
  - **`isLumpSum`**:
    - true for `[{name:'Pauschalabrechnung'}]`, `[{name:' pauschalabrechnung '}]`, and `[{name:'Other'},{name:'PAUSCHALABRECHNUNG'}]`;
    - false for `[]`, `null`, `undefined`, `'Pauschalabrechnung'` (not an array), `[{name:'Pauschal'}]` and `[{}]`.
  - **`parseAmount`**:
    - `'10.000,00'`, `'10,000.00'`, `'10000'`, `'10.000'`, `'10,000'`, `"10'000"`, `' 10 000 € '` and `'EUR 10.000'` → `10000`;
    - `'1500,5'` → `1500.5`; `'1.234.567,89'` → `1234567.89`;
    - `''`, `null`, `'abc'`, `'0'` and `'-5'` → `null`.
  - **`parseCurrency`**: `' chf '` → `'CHF'`; `''`, `null` and `undefined` → `'EUR'`.
  - **`lumpSumOf`**:
    - With hourly tags, it returns `{ billing_mode: 'hourly', lump_sum: null }`.
    - `lumpSumOf({ tags: [{name:'Pauschalabrechnung'}], cv3: '10.000,00', cv4: '', invoiced: '4000.00' })` returns `{ billing_mode: 'lump_sum', lump_sum: { agreed: 10000, currency: 'EUR', invoiced: 4000, earned_pct: 40 } }`.
    - With `invoiced: '11000'`, `earned_pct` is `110`.
    - With `cv3: ''`, `agreed` is `null` and `earned_pct` is `null`.
    - With `invoiced: '1234.565'`, `invoiced` is `1234.57` (rounded to cents).
- [X] T004 [P] In `api/tests/burndown.test.js`, inside `describe('listProjectsWithStats')`, add tests using the existing mocked `query`:
  - **(a)** A row with `tags: [{name:'Pauschalabrechnung'}], cv3: '10000', cv4: 'CHF', invoiced: '2500'` returns:
    - `billing_mode: 'lump_sum'`;
    - `lump_sum: { agreed: 10000, currency: 'CHF', invoiced: 2500, earned_pct: 25 }`.
  - **(b)** A row with `tags: []` returns `billing_mode: 'hourly'` and `lump_sum: null`, and all existing fields keep their values.
  - **(c)** The result objects contain no `tags`, `cv3`, `cv4` or `invoiced` keys at the top level.
  - **(d)** The SQL passed to `query` contains `raw->'tags'` and `FROM invoices i`.

### Implementation

- [X] T005 Run `cd api && npm test` and confirm that T003 and T004 fail (missing module or fields).
- [X] T006 [P] Create `api/src/services/lump-sum.js` with `isLumpSum(tags)`, `parseAmount(str)`, `parseCurrency(str)` and `lumpSumOf({ tags, cv3, cv4, invoiced })`, as in research R4–R6 and plan note 1.
  - `parseAmount` steps:
    1. Strip everything except digits, `.`, `,` and `-`.
    2. If the result is empty or negative, return `null`.
    3. Determine the decimal separator by the R4 rules, remove the thousands separators, normalize the decimal separator to `.`, then `Number()`.
    4. Return the number if it is finite and > 0, otherwise `null`.
  - `earned_pct` is `Math.round(invoiced / agreed * 100)`; `invoiced` is rounded to cents.
- [X] T007 [P] In `api/src/services/turnover.js`, change `const COUNTED` to `export const COUNTED`. Don't change its content.
- [X] T008 In `api/src/services/burndown.js` `listProjectsWithStats()`:
  - Import `COUNTED` from `./turnover.js` and `lumpSumOf` from `./lump-sum.js`.
  - Add to the SELECT list:

    ```sql
    p.raw->'tags' AS tags, p.raw->>'custom_value3' AS cv3, p.raw->>'custom_value4' AS cv4,
    (SELECT COALESCE(SUM(i.amount), 0) FROM invoices i WHERE i.project_id = p.id AND ${COUNTED}) AS invoiced
    ```

  - In the row mapper, destructure `{ tags, cv3, cv4, invoiced, ...r }` and spread `...lumpSumOf({ tags, cv3, cv4, invoiced })` into the returned object.
- [X] T009 Run `cd api && npm test`; all tests pass, including T003 and T004.
- [X] T010 [P] Create `frontend/src/utils/money.js` with `formatMoney(amount, currency = 'EUR')`:
  - `null` or `undefined` → `'—'`;
  - `'EUR'` → `formatEUR(amount)` from `./timesheet.js`;
  - otherwise `new Intl.NumberFormat('en-GB', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)`;
  - on a `RangeError`, `${Number(amount).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`.

**Checkpoint**: `GET /api/projects` returns `billing_mode` and `lump_sum`; hourly projects are unchanged.

---

## Phase 3: User Story 1 — Lump-sum projects show agreed and earned lump sum instead of hours (Priority: P1) 🎯 MVP

**Goal**: On the classic dashboard and the project detail, lump-sum projects show the marker, the agreed lump sum, the earned % and the turnover. They show no hours, burndown or timesheet (FR-003 to FR-005, FR-009).

**Independent Test**: quickstart checks 2, 3, 6 and 7. Tag one project, sync, and check its card and detail view. Then check that an hourly project looks unchanged.

- [X] T011 [P] [US1] In `frontend/src/components/ProjectCard.jsx`, add a lump-sum variant when `project.billing_mode === 'lump_sum'`.
  - **Badge**: show a `LUMP SUM` badge next to the name, styled like the existing CLOSED badge (`var(--border)` / `var(--muted)`). If the project is closed, show both badges.
  - **No timesheet icon**: don't render the `▦` timesheet button, even if `onOpenTimesheet` is passed.
  - **Bar**: width `Math.min(earned_pct ?? 0, 100)%`. The colour follows the existing rule: `var(--muted)` if closed, `var(--accent2)` if `earned_pct > 100`, else `var(--accent)`.
  - **Stats row**:
    - if `lump_sum.agreed` is set: `{earned_pct}%` · `{formatMoney(agreed, currency)}` · end date;
    - otherwise: `Lump sum not set` · end date.
  - Hourly projects render exactly as before.
- [X] T012 [US1] In `frontend/src/App.jsx`, apply the changes below with `const isLumpSum = selected?.billing_mode === 'lump_sum'`.
  - **(a) Burndown effect**: skip `fetchBurndown` when `isLumpSum`; set `burndown` to `null` and `chartLoad` to `false`.
  - **(b) Timesheet**:
    - Hide the `▦ Timesheet` header button when `isLumpSum`.
    - Pass `onOpenTimesheet` to `ProjectCard` only for hourly projects, in the sidebar list around line 179.
  - **(c) Lump-sum stats**: when `isLumpSum`, render a 3-cell stats grid in the same style as the hour stats:
    - `Agreed` = `formatMoney(agreed, currency)`, or `Not set`;
    - `Invoiced` = `formatMoney(invoiced, currency)`;
    - `Earned` = `${earned_pct}%` or `—`, coloured `var(--accent2)` when it is above 100.
  - **(d) Hide burndown**: hide the BURNDOWN CHART card and the Ideal/Actual legend when `isLumpSum`.
  - **(e) Keep turnover**: keep `<ProjectTurnover projectId={selected.id} … />` for both modes.
- [X] T013 [US1] Run `cd frontend && npm run build`; it succeeds.

**Checkpoint**: US1 is usable on the classic dashboard; this is the MVP.

---

## Phase 4: User Story 2 — Turnover overviews include lump-sum projects (Priority: P1)

**Goal**: Turnover totals stay complete and unchanged (FR-006, SC-003).

**Independent Test**: The yearly overview totals are identical before and after tagging a project.

- [X] T014 [P] [US2] In `api/tests/turnover.test.js`, add a test asserting that `getYearTurnover`'s SQL does not filter by tags or billing mode: it does not contain `tags` or `custom_value`. This guards SC-003 against later regressions.
- [X] T015 [US2] Run `cd api && npm test`; it passes. Confirm by reading `api/src/services/turnover.js` that the only change there is the `export` from T007.

**Checkpoint**: The turnover is identical for both billing modes.

---

## Phase 5: User Story 3 — AI Dashboard respects lump-sum projects (Priority: P2)

**Goal**:
- Lump-sum projects get their lump-sum card and turnover, never a burndown or timesheet, whatever the declaration says.
- The project order is deterministic.
- A cached layout does not survive a billing-mode change (FR-007, FR-008).

**Independent Test**: quickstart check 5. Generate the AI Dashboard with the default declaration while one project is tagged, then remove the tag, sync, and reopen the dashboard.

### Tests (write first; they must fail before T018)

- [X] T016 [P] [US3] In `api/tests/ai-dashboard.test.js`, extend `describe('SYSTEM_PROMPT')`. Assert that the prompt contains:
  - `billing_mode`;
  - `lump_sum`;
  - `never use BurndownChart or TimesheetSummary`;
  - `Keep the order of the project list`.
- [X] T017 [P] [US3] In `api/tests/ai-dashboard.test.js`, add `describe('generateOrCachedLayout lump sum')`. Use the mocked `listProjectsWithStats` and mock `fetch` to return a minimal Ollama SSE stream.
  - **(a) Payload**: return 3 in-progress projects:
    - `{id:1, billing_mode:'hourly', progress:50}`;
    - `{id:2, billing_mode:'lump_sum', progress:0, lump_sum:{earned_pct:30}}`;
    - `{id:3, billing_mode:'hourly', progress:90}`.

    Assert that the user message sent to Ollama, parsed from the fetch body, lists the projects in order `3, 1, 2`. Project 2 must have `progress: null`, `earned_pct: 30` and `billing_mode: 'lump_sum'`.
  - **(b) Cache key**:
    1. Call `generateOrCachedLayout` twice with the same projects. The second call is served from the cache (`fetch` is called once).
    2. Change project 1 to `billing_mode:'lump_sum'` and call it a third time. `fetch` is called again.

### Implementation

- [X] T018 [US3] In `api/src/services/ai-dashboard.js`:
  - **(a) Prompt**:
    - Add rule 10 to `SYSTEM_PROMPT`: `For projects with billing_mode "lump_sum" never use BurndownChart or TimesheetSummary; where the declaration asks for them, use ProjectTurnover(projectId) once instead.`
    - Change rule 6 to `Keep the order of the project list.`
    - Mention `billing_mode` in the ProjectCard line, e.g. `— project summary card (hours or lump sum)`.
  - **(b) Project order and payload** in `generateOrCachedLayout`:
    - Load and filter the projects **before** the cache check.
    - Sort hourly projects by `progress` descending, then lump-sum projects by `lump_sum.earned_pct` descending, with `null` last.
    - Compute `const fingerprint = projects.map(p => \`${p.id}:${p.billing_mode}\`).sort().join(',')` and `hash = computeDeclarationHash(declaration + '\n' + fingerprint)`.
  - **(c) Ollama payload**: in `streamFromOllama`, add `billing_mode` to each project in the payload. For lump-sum projects, send `progress: null` and `earned_pct`.
  - Keep `debugInfo` and the status endpoint working; `isCached()` is unchanged.
- [X] T019 [US3] Run `cd api && npm test`; all tests pass, including T016 and T017.
- [X] T020 [P] [US3] In `frontend/src/components/ai/ProjectCard.ai.jsx`, add the lump-sum variant when `project.billing_mode === 'lump_sum'`:
  - **Header**: name, a `LUMP SUM` badge (`var(--border)`/`var(--muted)`), and `{earned_pct}%` coloured `var(--accent2)` above 100, else `var(--accent)`.
  - **Bar**: `min(earned_pct ?? 0, 100)%`.
  - **Row**:
    - if agreed is set: `Agreed: {formatMoney(agreed, currency)}` · `Invoiced: {formatMoney(invoiced, currency)}`;
    - otherwise: `Lump sum not set` · `Invoiced: {formatMoney(invoiced, currency)}`.
  - Use design tokens only; the existing hourly variant stays unchanged.
- [X] T021 [P] [US3] In `frontend/src/components/ai/BurndownChart.ai.jsx`, read `projects` from `AIDashboardContext`. If the project with `projectId` has `billing_mode === 'lump_sum'`, return `<ProjectTurnoverAI props={{ projectId }} />` from `./ProjectTurnover.ai.jsx` without fetching the burndown. Move the `fetchBurndown` effect so the hooks order stays valid: run the effect always, but skip the fetch when lump sum.
- [X] T022 [P] [US3] In `frontend/src/components/ai/TimesheetSummary.ai.jsx`, return `null` when the project's `billing_mode === 'lump_sum'`. Keep the hooks order valid: skip `fetchTimesheet` in the effect for lump sum and return `null` after the hooks.
- [X] T023 [US3] Run `cd frontend && npm run build`; it succeeds.

**Checkpoint**: The AI Dashboard handles lump-sum projects deterministically.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T024 [P] In `README.md`, add a section `Lump-sum projects (Pauschalabrechnung)` covering:
  - the InvoiceNinja tag (Settings → Tags, type Project);
  - custom field 3 "Vereinbarte Pauschale" (accepted number formats) and custom field 4 "Projektwährung" (default EUR);
  - earned % = invoiced ÷ agreed;
  - what each view shows (card, detail, AI Dashboard), and that the turnover is unchanged;
  - the full-resync hint from the quickstart.

  Also extend the API section with the new `billing_mode` and `lump_sum` fields of `GET /api/projects`, and the AI component table note: "BurndownChart / TimesheetSummary are replaced or skipped for lump-sum projects".
- [X] T025 Docker-first validation (constitution): run `docker compose up -d --build` locally. Note: the local stack has no production data and the local container can't reach macmini.
  - With a test row, either run `UPDATE projects SET raw = jsonb_set(raw, '{tags}', '[{"name":"Pauschalabrechnung"}]') …` on a local DB, or reuse a temporary stack with the project postgres image.
  - Check `GET /api/projects`, the classic card, the detail view, and a tag-removal round trip.
  - Record the results in the Validation Log.
- [X] T026 Post-deploy checklist for macmini, for the PR description (manual, not executed here):
  1. Merge, wait for CI (multi-arch images), then run Portainer **Pull and redeploy**.
  2. Run the quickstart "Verify tags reach the database" on production. If the tagged project shows no tags, do the full project resync.
  3. Run quickstart checks 1–7 on "NLW Bonus" or the real lump-sum project.
  4. Spot-check that the yearly turnover totals equal the values noted before the deploy (SC-003).
  5. Check the AI Dashboard with the default declaration.

---

## Dependencies & Execution Order

- **Setup (T001–T002)** comes first.
- **Foundational (T003–T010)** blocks all stories. The order is T003/T004 → T005 → T006/T007 → T008 → T009. T010 is independent.
- **US1 (T011–T013)** needs T010 and T008.
- **US2 (T014–T015)** needs T007, and can run in parallel with US1.
- **US3 (T016–T023)** needs T008 and T010.
  - The API part (T016–T019) and the frontend part (T020–T022) can run in parallel.
  - T020 reuses `formatMoney` (T010).
- **Polish**: T024 can run anytime after the design. T025 runs after all stories, then T026.

## Parallel Examples

- **Foundational tests**: T003 ∥ T004.
- **Foundational implementation**: T006 ∥ T007 ∥ T010.
- **US1**: T011 (ProjectCard) can run while the App.jsx changes (T012) are being prepared; T012 is sequential.
- **US3**:
  - tests T016 ∥ T017;
  - after T019, the frontend tasks T020 ∥ T021 ∥ T022 (separate files).

## Implementation Strategy

1. **MVP = Foundational + US1**: lump-sum projects are recognised and shown correctly on the classic dashboard.
2. Add **US2**, a regression guard (small).
3. Add **US3**, the AI Dashboard.
4. Finish with the README, Docker validation and the macmini rollout checklist.

---

## Validation Log

**T001 baseline (2026-11-25)**: 156 API tests pass; frontend build OK.

**T002 tags in the database**: production is not reachable from the workstation (no DB access to macmini). The tag shape `tags: [{id, name, color}]` was confirmed in the InvoiceNinja v5 source (research R1). The live check moved to T026, step 2.

**T005 / T017 red phase**: before the implementation, the new tests failed for the expected reasons:
- the `lump-sum.js` module was missing;
- the `billing_mode` / `lump_sum` fields were missing;
- the prompt lacked the lump-sum rule;
- a billing-mode change did not invalidate the cache.

**Tests after implementation**: 198 API tests pass (+42), and the frontend build is OK.

**Formatting note**: `formatMoney` formats any well-formed 3-letter code via Intl, so "XYZ" becomes "XYZ 8,000.00". The fallback "8,000.00 <code>" applies only to malformed codes. quickstart.md and research.md R5 are updated accordingly.

**T025 Docker validation** (temporary stack: project postgres image + API image built from this branch, seeded test data; cleaned up afterwards):

| Check | Result |
|-------|--------|
| `Lump EUR`: tag "Pauschalabrechnung", cv3 `10.000,00`, cv4 empty; invoices 2500 (paid, 2026) + 1500 (sent, 2025) counted, plus a draft of 999 and a deleted invoice of 777 not counted; 2 time entries | `lump_sum`, agreed 10000 EUR, invoiced 4000, **40 %**. Invoiced is not multiplied by the time-entries join, and equals the per-project turnover total (4000). |
| `Lump CHF`: cv3 `8'000`, cv4 `CHF`, invoice 9000 | agreed 8000 CHF, invoiced 9000, **113 %** (not capped) |
| `Lump CHF unset`: tag `" pauschalabrechnung "`, cv3 empty, cv4 `chf` | `lump_sum`, agreed `null`, currency `CHF`, earned `null` |
| `Hourly A`: other tag only; `No tags field`: raw `{}` | `hourly`, `lump_sum: null`, hour figures unchanged (progress 40 %) |
| Turnover 2025 / 2026 | Lump-sum projects included; totals 1500 / 14500 match the seeded counted invoices (SC-003) |
| Tag removed, then re-added (raw updated as a sync would) | `hourly` → `lump_sum` on the next read (SC-004) |
| `GET /api/projects` latency | 8 ms |

**Not verified here** (no browser; the local stack has no Ollama or production data). These move to T026:
- the visual check of the classic card, the detail view and the AI blocks;
- the AI Dashboard generation with a lump-sum project.

The AI ordering, payload and cache invalidation are covered by unit tests (T017).

**T026 post-deploy checklist for macmini** (for the PR description):
1. Merge, wait for CI (multi-arch images), then run Portainer **Pull and redeploy**.
2. In InvoiceNinja, assign the tag "Pauschalabrechnung" to the lump-sum project(s). Set custom field 3 "Vereinbarte Pauschale" and, if not EUR, custom field 4 "Projektwährung". Then run `POST /api/sync`.
3. Run `curl -s http://macmini.local:6088/api/projects | jq '.data[] | {name, billing_mode, lump_sum}'`. The tagged project must be `lump_sum` with the expected agreed amount and earned %. If it is still `hourly`, follow the quickstart "Verify tags reach the database" and do a full project resync.
4. **Classic dashboard**:
   - The card shows LUMP SUM, the agreed amount and the earned %, and has no timesheet icon.
   - The detail view shows Agreed / Invoiced / Earned and the turnover, with no burndown and no Timesheet button.
   - Hourly projects are unchanged.
5. **€ Turnover overview**: the year totals are unchanged against the values before the deploy.
6. **AI Dashboard (default declaration)**: the lump-sum card is followed by the project turnover; there is no burndown or timesheet for that project.
7. Remove the tag, sync, and reload the AI Dashboard. The project appears as hourly again, and the layout is regenerated.
