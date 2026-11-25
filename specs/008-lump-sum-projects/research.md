# Research: Lump-Sum Projects

## R1 — How InvoiceNinja exposes project tags

- **Decision**: Read tags from the synced project JSON (`projects.raw->'tags'`). No change to the InvoiceNinja client is needed.
- **Findings** (InvoiceNinja v5-stable source):
  - `ProjectTransformer::transform()` emits `'tags' => $this->transformTags($project)` (`app/Transformers/ProjectTransformer.php`).
  - `EntityTransformer::transformTags()` returns an array of `{ id: string, name: string, color: string|null }`. A project without tags returns `[]`.
  - Tags are a plain field, so no `include=` parameter is needed. The list endpoint eager-loads them (`Project::filter($filters)->with('tags')`).
  - Saving a project with `tags` calls `syncResolvedTags()`, which calls `touchQuietly()` on the project. That bumps `updated_at`, so the existing incremental project sync (`updated_at` filter) picks up tag changes.
- **Gap**: Renaming a tag does not touch the projects that use it. This is accepted, because the name "Pauschalabrechnung" is fixed. If it is renamed, a full project resync is needed (see the quickstart).
- **Alternatives considered**: a separate `/tags` sync. It was rejected as unnecessary, because the tags are already embedded in each project.

## R2 — Where the billing mode is derived

- **Decision**: Derive the billing mode, agreed lump sum and currency **in the API at read time** from `projects.raw`: `raw->'tags'`, `raw->>'custom_value3'` and `raw->>'custom_value4'`. The logic lives in a pure module, `api/src/services/lump-sum.js`.
- **Rationale**:
  - No schema migration and no worker change. Principle III keeps the worker free of business logic.
  - `raw` already holds the full InvoiceNinja project as JSONB.
  - Every sync refreshes `raw`, which satisfies FR-002.
- **Alternatives considered**: new columns (`billing_mode`, `lump_sum_amount`) filled by the worker. That would need a migration plus business logic in the worker, with no performance need (fewer than 50 projects).

## R3 — "Earned" = invoiced, all years

- **Decision**: `earned` = the sum of `invoices.amount` over the **counted** invoices of the project, all years. This reuses the `COUNTED` filter from `services/turnover.js`, exported for this purpose: dated, not deleted, status sent / partial / paid, project visible.
- **Rationale**: The value is identical to the sum of the "Invoiced" column in the project turnover table (FR-004b, SC-006).
- **Implementation**: a correlated subquery in `listProjectsWithStats()`. A JOIN would multiply rows with the `time_entries` join.

## R4 — Parsing the agreed lump sum (custom field 3)

- **Decision**: `parseAmount(str)`:
  1. Trim the input and strip spaces, apostrophes (`'`, as in CHF "10'000") and currency symbols or letters.
  2. If both `.` and `,` occur, the **last** one is the decimal separator and the other is a thousands separator.
  3. If only one kind of separator occurs:
     - If it occurs more than once, or exactly once followed by exactly 3 digits, it is a thousands separator ("10.000" → 10000, "10,000" → 10000).
     - Otherwise it is the decimal separator ("1500,5" → 1500.5).
  4. The result must be a finite number > 0. Otherwise the result is `null`, shown as "Lump sum not set".
- **Accepted ambiguity**: "1.500" is read as 1500, never as 1.5. A lump sum below 10 is not realistic.

## R5 — Project currency (custom field 4) and money formatting

- **Decision**:
  - The currency is `custom_value4` trimmed and upper-cased; empty means `EUR`.
  - The frontend formats amounts with `formatMoney(amount, currency)` in `frontend/src/utils/money.js`.
    - `EUR` stays identical to `formatEUR`: "10,000.00 €", so EUR projects look as today.
    - Other valid ISO codes use `Intl.NumberFormat('en-GB', { style: 'currency', currency })`, e.g. "CHF 8,000.00".
    - A well-formed but unknown code is formatted by Intl with the code as prefix (`"XYZ 8,000.00"`). A malformed code (Intl throws a `RangeError`) falls back to `"8,000.00 <code>"`.
- **Rationale**: Intl validates the codes, so there is no currency table to maintain.

## R6 — Earned %

- **Decision**: `earned_pct = Math.round(invoiced / agreed * 100)` when `agreed` is set, otherwise `null`. It is not capped, so it can exceed 100 %.
- **Display**: the bar width is capped at 100 %. The colour uses the existing over-budget token (`var(--accent2)`) above 100 %, like the hour progress.

## R7 — AI Dashboard: making the rules hold regardless of the model

- **Decision**: use two layers.
  1. **Prompt**:
     - Each project sent to the model carries `billing_mode`. Lump-sum projects also carry `earned_pct`, and their `progress` is `null`.
     - New rule: for projects with `billing_mode: "lump_sum"`, never use `BurndownChart` or `TimesheetSummary`. Where the declaration asks for them, use `ProjectTurnover(projectId)` once instead.
     - Ordering becomes deterministic in the API: hourly projects by `progress` descending, then lump-sum projects by `earned_pct` descending (`null` last). Rule 6 now says "keep the order of the project list".
  2. **Client guard** (deterministic, FR-007 "regardless of the declaration"):
     - `BurndownChart.ai` renders `ProjectTurnover` for a lump-sum project.
     - `TimesheetSummary.ai` renders nothing for a lump-sum project.
     - `ProjectCard.ai` shows the lump-sum variant.
- **Rationale**: a 7B model does not follow conditional rules 100 % of the time. The guard makes SC-002 hold either way, and the prompt keeps the layout clean when the model complies.
- **Known edge**: if the model emits both `BurndownChart(n)` and `ProjectTurnover(n)` for a lump-sum project, the turnover appears twice. This is cosmetic, and the prompt rule prevents it.

## R8 — AI layout cache must follow billing-mode changes (FR-008)

- **Decision**: the cache key becomes `hash(declaration + billing fingerprint)`. The fingerprint is the sorted `id:billing_mode` list of in-progress projects.
- **How it is computed**: `generateOrCachedLayout()` already loads the projects. It now loads them **before** the cache check, which is one cheap query.
- **Rationale**: the worker syncs in a separate process and cannot reach the API's in-memory cache. With the fingerprint, a tag change after a cron sync invalidates the layout on the next view.
- **Not in the key**: the agreed sum and earned % are read live from the project list by the blocks, so they don't need to be.
