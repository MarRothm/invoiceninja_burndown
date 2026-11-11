# Implementation Plan: Project Turnover by Year

**Branch**: `005-project-turnover-by-year` | **Date**: 2026-11-11 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/005-project-turnover-by-year/spec.md`

## Summary

Show gross invoiced, paid and open amounts per calendar year for each project, and add a
cross-project overview for one selected year. The sync worker gains an incremental
**invoice** sync into a new `invoices` table. Payments are not synced: InvoiceNinja keeps
`paid_to_date` per invoice net of refunds, which is exactly the invoice-year attribution the
spec chose. Two read-only endpoints (`GET /api/projects/:id/turnover`,
`GET /api/turnover?year=YYYY`) aggregate with one shared filter. The frontend adds a
turnover table to the legacy project detail view and a `€ Turnover` sidebar entry that opens
the overview in both dashboard modes. Because `init.sql` only runs on a fresh volume, the
API also applies the idempotent invoice DDL at startup.

## Technical Context

**Language/Version**: JavaScript (ESM) — Node.js 22 (API/worker), React 18 (frontend)

**Primary Dependencies**: Existing only — Fastify 5, `pg`, `node-cron`, React 18, Vite 5. No additions.

**Storage**: PostgreSQL — new table `invoices`, new `sync_state` row `invoices`; read-only use of `projects`

**Testing**: Vitest (`api/tests/`) for the invoice mapping, aggregation helpers, `parseYear` and routes; manual UI validation per [quickstart.md](quickstart.md)

**Target Platform**: Docker Compose / Portainer stack; desktop browsers

**Project Type**: Enhancement of existing web application (API + worker + SPA)

**Performance Goals**: Turnover visible ≤ 2 s after selecting a project (SC-003). This is a single grouped query on an indexed table with at most a few thousand invoices.

**Constraints**:
- InvoiceNinja is the only source; read-only views (FR-009, Constitution II)
- Gross amounts, invoice-year attribution, `open = invoiced − paid` (FR-003/FR-004, R2)
- Shared inclusion filter for both endpoints (FR-014, R6)
- Existing databases must gain the table without manual steps (R5)
- Styling only via existing CSS variables; reuse `formatEUR` (FR-008, FR-011)

**Scale/Scope**: 2 routes, 1 new service, 1 schema module, sync extension, 2 new components, edits to `App.jsx`, `api.js`, `init.sql`, `README.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Self-Hosted & Network-Boundary Security | ✅ Pass | New read-only endpoints behind the same network boundary. Invoice amounts are more sensitive than hours, but the existing accepted-risk model (no built-in auth, LAN/VPN only) already covers them; `SECURITY.md` gets a note that financial data is now exposed |
| II. InvoiceNinja Single Source of Truth | ✅ Pass | Invoices come only from the InvoiceNinja API via the sync worker; no editing |
| III. Layered Service Architecture | ✅ Pass | InvoiceNinja calls only in `invoiceninja.js`/sync; API reads PostgreSQL; frontend calls only the API |
| IV. Security Hygiene | ✅ Pass | No new dependencies; strict `parseId`/`parseYear`; parameterised SQL |
| V. Simplicity & Observable Configuration | ✅ Pass | No env vars; payments deliberately not synced (R1); startup DDL is idempotent and justified by R5; `README.md` updated (endpoints, sync scope, feature section) |

**Post-design re-check (after Phase 1)**: ✅ All pass. The only new mechanism is `ensureSchema()`,
which is required so existing deployments get the table (R5) and is limited to `IF NOT EXISTS` statements.

## Project Structure

### Documentation (this feature)

```text
specs/005-project-turnover-by-year/
├── spec.md
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   ├── turnover-api.md  # REST contract (+ sync response delta)
│   └── turnover-ui.md   # Detail table, sidebar entry, overview
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
init.sql                          # Updated: invoices table + index, sync_state row 'invoices'

api/
├── src/
│   ├── db/
│   │   └── schema.js             # New: ensureSchema() — same idempotent invoice DDL as init.sql
│   ├── server.js                 # Updated: await ensureSchema() before listen
│   ├── worker.js                 # Updated: await ensureSchema() before initial sync
│   ├── routes/
│   │   └── projects.js           # Updated: GET /projects/:id/turnover, GET /turnover
│   └── services/
│       ├── invoiceninja.js       # Updated: fetchInvoices(updatedAfter) paginated, status=active,archived,deleted
│       ├── sync.js               # Updated: syncInvoices() upsert; runFullSync returns invoices count
│       └── turnover.js           # New: parseYear(), toTurnoverRow() (pure), getProjectTurnover(id), getYearTurnover(year)
└── tests/
    ├── invoiceninja.test.js      # Updated: invoice → row mapping (status string, '' date, amounts)
    ├── turnover.test.js          # New: parseYear, row rounding/open, ordering, totals, empty project
    └── routes.test.js            # Updated: turnover routes 200 / 400 / 404; sync response

frontend/src/
├── App.jsx                       # Updated: view state 'dashboard' | 'turnover', sidebar button, <ProjectTurnover>, <TurnoverOverview>
├── components/
│   ├── ProjectTurnover.jsx       # New: per-year table in legacy detail view
│   └── TurnoverOverview.jsx      # New: year selector + cross-project table
└── hooks/
    └── api.js                    # Updated: fetchProjectTurnover(id), fetchTurnover(year)

README.md                         # Updated: endpoint table, sync covers invoices, Turnover section
SECURITY.md                       # Updated: accepted risk now includes invoice amounts
```

**Structure Decision**: Additive change across the existing `api/` and `frontend/` layout.
Turnover gets its own service (not part of `burndown.js`) because it reads a different table.
Routes stay in `routes/projects.js` alongside the other project endpoints.

## Design Notes

- **Sync**: see research R1–R4. `syncInvoices()` runs after `syncProjects()` so project links resolve. Each invoice is upserted with `ON CONFLICT (invoiceninja_id) DO UPDATE`, and the cursor is saved in `sync_state('invoices')`.
- **Shared filter**: one SQL fragment in `turnover.js` covers counted invoices and visible projects (data-model "Counted invoice"). `toTurnoverRow({ invoiced, paid, invoice_count })` rounds the values and derives `open`.
- **Payloads**: [contracts/turnover-api.md](contracts/turnover-api.md).
- **UI**: [contracts/turnover-ui.md](contracts/turnover-ui.md). `App.jsx` keeps a `view` state separate from `dashMode`. A row click calls `setSelected(p)`, `setView('dashboard')`, and switches to legacy mode if needed (R7). `ProjectTurnover` reloads when the selected project changes and after a sync (it reuses the existing reload trigger).
- **Rollout**: `ensureSchema()` makes upgrades of existing Portainer stacks work without manual SQL. The first sync after the upgrade fetches every invoice (the cursor starts at the epoch).

## Complexity Tracking

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|--------------------------------------|
| `ensureSchema()` at API/worker startup | `init.sql` runs only on a fresh postgres volume; existing deployments would lack `invoices` | Manual SQL on upgrade is easy to forget with manual Portainer redeploys and would break sync |
