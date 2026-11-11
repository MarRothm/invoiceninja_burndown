# Phase 0 Research: Project Turnover by Year

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-11-11

No `NEEDS CLARIFICATION` items remained after the 2026-11-11 clarification session. The
decisions below map the spec onto the existing sync/API/frontend layers. InvoiceNinja facts
are taken from the v5-stable source (`InvoiceTransformer`, `Invoice` model, `RefundPayment`).

## R1 — Sync invoices only, not payments

- **Decision**: Sync InvoiceNinja **invoices** and use their own `amount`, `paid_to_date` and
  `balance` fields. Do not sync payments.
- **Rationale**: With the invoice-year attribution chosen in the spec (FR-004), "paid in year
  Y" is the sum of `paid_to_date` over invoices dated in Y. InvoiceNinja keeps
  `paid_to_date` per invoice up to date: payments raise it, and refunds lower it while raising
  `balance` (`RefundPayment::adjustInvoices`). A payment split across invoices from different
  years is already split per invoice. Payments not applied to any invoice never touch an
  invoice, so they are not counted, as the spec requires. One new resource instead of two (payments +
  paymentables), and no allocation logic (Constitution V).
- **Alternatives considered**: Sync `/payments?include=paymentables` and sum the applied
  amounts minus refunds per invoice. That gives the same numbers with much more code, and is
  only needed for a cash view (payment-date attribution), which the spec rejected.
- **Consequence**: Credits applied to an invoice also count as "paid". This is consistent with
  InvoiceNinja's own "paid to date" and is noted in the spec's Assumptions.

## R2 — Which invoices count

- **Decision**: Include `status_id ∈ {2 sent, 3 partial, 4 paid}` and `is_deleted = false`.
  Exclude 1 draft, 5 cancelled and 6 reversed. Archived invoices are still included.
- **Rationale**: FR-005. `status_id` is sent as a string (`"1"`–`"6"`). Overdue/unpaid
  (−1/−2) are computed values, never stored, so they arrive as 2/3. Archiving hides an invoice
  in InvoiceNinja but does not void it.
- **Per-year values**: `invoiced = Σ amount`, `paid = Σ paid_to_date`,
  `open = invoiced − paid`. `open` is computed rather than summed from `balance`, so that
  paid + open = invoiced holds exactly (FR-001/FR-004).

## R3 — Incremental sync and deletions

- **Decision**: Add `fetchInvoices(updatedAfter)` in `api/src/services/invoiceninja.js`,
  paginated like `fetchTasks` (500 per page) with `updated_at` and
  `status=active,archived,deleted`. Upsert every invoice by `invoiceninja_id`, storing
  `is_deleted`. A new `sync_state` row `invoices` holds the cursor. `runFullSync` calls it
  after `syncProjects`.
- **Rationale**: Without the explicit status filter, InvoiceNinja list endpoints return
  active records only, so archived or deleted invoices would never reach the incremental
  sync. Upserting (instead of skipping) keeps status, payment and deletion changes in sync.
- **Verification**: To check on a live instance ([quickstart.md](quickstart.md) step 1).
  Archive one invoice and delete another, sync, and confirm both rows are updated.

## R4 — Invoice ↔ project link

- **Decision**: Store `project_id` as a nullable FK. Resolve it from the invoice's
  `project_id` (hashed id) via `projects.invoiceninja_id`. Unknown or empty → `NULL`.
  Invoices without a project are stored but never counted.
- **Rationale**: Storing invoices without a project means a later project assignment in
  InvoiceNinja is picked up by the next upsert. Projects are synced before invoices, so new
  projects resolve in the same run.

## R5 — Schema rollout on existing databases

- **Decision**: Add the `invoices` table and the `invoices` sync_state row to `init.sql` (for
  new volumes) **and** apply the same idempotent DDL at API startup in a new
  `api/src/db/schema.js` (`ensureSchema()`). Both `api/src/worker.js` (before the initial sync) and `api/src/server.js` (before `listen`, because `POST /api/sync` runs a sync too) call it.
- **Rationale**: `init.sql` only runs through `/docker-entrypoint-initdb.d` when the postgres
  volume is first created. Existing Portainer and Compose deployments would otherwise start
  without the table, and sync would fail. All statements are
  `CREATE … IF NOT EXISTS` / `ON CONFLICT DO NOTHING`, so repeated runs are harmless.
- **Alternatives considered**: Ask the operator to run the SQL manually after the upgrade.
  That's error-prone with manual Portainer redeploys and is easy to forget.

## R6 — Endpoints

- **Decision**: `GET /api/projects/:id/turnover` returns the per-year rows for one project,
  newest first, plus a total. `GET /api/turnover?year=YYYY` returns the cross-project overview
  for one year plus the list of years that have invoices. Both use one shared SQL `WHERE` for
  inclusion (R2) and the existing project visibility rule (not deleted, not archived).
- **Rationale**: Follows the `routes/projects.js` → `services/*.js` pattern. A shared filter
  makes FR-014 (identical numbers in both views) true by construction. The year is validated
  as 2000–2100, consistent with `parseMonth`.

## R7 — Overview placement and navigation

- **Decision**: A `€ Turnover` button below **↻ Sync now** in the sidebar sets a main-area
  view `turnover` in `App.jsx`, shown in both dashboard modes. Clicking a project row selects
  that project, returns to the dashboard view and switches to legacy mode if AI mode is
  active, because only legacy mode has a single-project detail view.
- **Rationale**: FR-011/FR-013. The AI dashboard has no project detail view, so the
  per-project table lives only in the legacy detail view (spec Assumptions).

## R8 — Formatting and tests

- **Decision**: Reuse `formatEUR` from `frontend/src/utils/timesheet.js` (feature 004) for
  every amount (FR-008). API tests use Vitest for the pure aggregation helpers, the sync
  mapping and the routes. There are no frontend tests, as in features 003 and 004; UI checks
  follow [quickstart.md](quickstart.md).
