# Implementation Plan: Lump-Sum Projects

**Branch**: `008-lump-sum-projects` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-lump-sum-projects/spec.md`

## Summary

Projects with the InvoiceNinja tag **Pauschalabrechnung** become *lump-sum* projects.

- **Detection**: the API derives the billing mode, the agreed lump sum (custom field 3) and the currency (custom field 4) at read time from the synced project JSON. No schema or worker change is needed.
- **Earned %**: invoiced (counted invoices, all years) ÷ agreed lump sum.
- **Classic dashboard and project detail**: these show the lump-sum card and stats plus the turnover, and hide hours, burndown and timesheet.
- **AI Dashboard**: lump-sum projects get turnover instead of burndown and timesheet. This is enforced by a prompt rule plus a deterministic client guard. The layout cache key includes the billing modes.

## Technical Context

- **Language/Version**: Node.js (ESM) for the API (Fastify); React + Vite for the frontend
- **Primary Dependencies**: existing only, no new packages
- **Storage**:
  - PostgreSQL has no schema change. The new values come from the `projects.raw` JSONB (`tags`, `custom_value3`, `custom_value4`) and from `invoices`.
- **Testing**:
  - Vitest in `api/tests/` covers:
    - the pure lump-sum helpers (tag match, amount parsing, earned %);
    - the `listProjectsWithStats` mapping;
    - the routes;
    - the prompt, cache key and project order.
  - The frontend has no test runner and gets none (YAGNI). The UI is checked manually via the quickstart.
- **Target Platform**: Docker Compose / Portainer on `macmini.local` (arm64)
- **Project Type**: web application (api + frontend)
- **Performance Goals**: `GET /api/projects` stays below 100 ms with fewer than 50 projects. It adds one correlated subquery per project on the indexed `invoices(project_id, invoice_date)`.
- **Constraints**:
  - Turnover totals must not change (SC-003).
  - Hourly projects must be unchanged (FR-009).
  - The UI must use design tokens only.
- **Scale/Scope**: about 12 files; no new endpoints

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|-----------|-----------|--------|
| I. Network-boundary security | No new endpoint. `GET /api/projects` gains derived, non-sensitive fields (lump sum, invoiced), which are already visible through turnover. | ✅ |
| II. InvoiceNinja single source of truth | The tag and the custom fields 3 and 4 are maintained in InvoiceNinja only and read from the synced data. The burndown logic for hourly projects is unchanged. | ✅ |
| III. One responsibility per service | The worker is unchanged and only stores the raw project. The derivation lives in the API. The frontend only calls the API. | ✅ |
| IV. Security hygiene | No new dependencies. | ✅ |
| V. Simplicity & observable config | No migration, no new env var, no new service. The UI reuses `ProjectTurnover` and the tokens (`--accent`, `--accent2`, `--muted`, `--border`). | ✅ |
| Workflow: README currency | Add a README section: tag, custom fields 3 and 4, what changes per view. | ✅ (task) |

**Gate result**: PASS.

**Post-design re-check**: PASS. The API contract is additive only (`billing_mode`, `lump_sum`). The AI grammar adds no new components, only a rule. The cache key change is internal.

## Project Structure

### Documentation (this feature)

```text
specs/008-lump-sum-projects/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/projects-and-ai.md
└── tasks.md            # /speckit-tasks
```

### Source Code (repository root)

```text
api/src/services/lump-sum.js          # NEW pure helpers: isLumpSum(tags), parseAmount(str), parseCurrency(str), lumpSumOf({...})
api/src/services/turnover.js          # export COUNTED (unchanged content)
api/src/services/burndown.js          # listProjectsWithStats: select raw tags / cv3 / cv4 + invoiced subquery; add billing_mode, lump_sum
api/src/services/ai-dashboard.js      # project list (billing_mode, earned_pct, ordering), prompt rule, cache key fingerprint
api/tests/lump-sum.test.js            # NEW
api/tests/burndown.test.js            # mapping of billing_mode / lump_sum
api/tests/ai-dashboard.test.js        # prompt rule, ordering, cache invalidation on mode change

frontend/src/utils/money.js                        # NEW formatMoney(amount, currency)
frontend/src/components/ProjectCard.jsx            # lump-sum variant (marker, agreed, earned %, no hours / timesheet icon)
frontend/src/App.jsx                               # detail: lump-sum stats row; skip burndown fetch/chart + Timesheet button; no onOpenTimesheet for lump sum
frontend/src/components/ai/ProjectCard.ai.jsx      # lump-sum variant
frontend/src/components/ai/BurndownChart.ai.jsx    # lump sum → ProjectTurnover
frontend/src/components/ai/TimesheetSummary.ai.jsx # lump sum → null

README.md                                          # "Lump-sum projects" section
```

**Structure decision**: Use the existing `api/` + `frontend/` layout. The lump-sum logic sits in one pure API module, so it can be unit-tested without a database.

## Implementation Notes

1. **`lump-sum.js`** (pure, no DB):
   - `isLumpSum(tags)`: `Array.isArray(tags) && tags.some(t => String(t?.name ?? '').trim().toLowerCase() === 'pauschalabrechnung')`.
   - `parseAmount(str)`: rules in research R4. Returns a number > 0 or `null`.
   - `parseCurrency(str)`: trimmed and upper-cased, or `'EUR'`.
   - `lumpSumOf({ tags, cv3, cv4, invoiced })` returns `{ billing_mode, lump_sum }`.

2. **`listProjectsWithStats`**: add the following to the SELECT list.

   ```sql
   p.raw->'tags' AS tags, p.raw->>'custom_value3' AS cv3, p.raw->>'custom_value4' AS cv4,
   (SELECT COALESCE(SUM(i.amount), 0) FROM invoices i WHERE i.project_id = p.id AND ${COUNTED}) AS invoiced
   ```

   `COUNTED` references `p`, which is valid in a correlated subquery. Remove the helper columns from the response and spread `lumpSumOf(...)` into it.

3. **AI service**:
   - **Project payload**: add `billing_mode`. For lump-sum projects, also add `earned_pct` and set `progress: null`.
   - **Ordering**: hourly projects by `progress` descending, then lump-sum projects by `earned_pct` descending, with `null` last.
   - **Prompt rule 10** (lump sum):
     > For projects with billing_mode "lump_sum" never use BurndownChart or TimesheetSummary; where the declaration asks for them, use ProjectTurnover(projectId) once instead.
   - **Rule 6**: "Keep the order of the project list."
   - **Cache**: `hash = computeDeclarationHash(declaration + '\n' + fingerprint)`. Load the projects before the cache check.

4. **Frontend**:
   - **`formatMoney`**: for `EUR`, delegate to `formatEUR`. Otherwise use Intl with `style: 'currency'`, and fall back to `"<amount> <CODE>"` on a `RangeError`.
   - **Lump-sum card** (classic and AI):
     - a "LUMP SUM" marker with the CLOSED badge style;
     - a bar at `min(earned_pct, 100)%`, coloured `--accent2` above 100;
     - the row `"{earned_pct}%"` · `"{formatMoney(agreed)}"`, or "Lump sum not set".
   - **Detail view**:
     - Skip `fetchBurndown` for lump-sum projects.
     - Render a 3-cell stats row: Agreed / Invoiced / Earned.
     - Hide the chart, the legend and the Timesheet button.
     - Keep `ProjectTurnover`.

## Complexity Tracking

No constitution violations.
