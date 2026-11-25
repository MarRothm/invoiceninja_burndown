# Burndown Stack

[![Tests](https://github.com/MarRothm/burndown/actions/workflows/test.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/test.yml)
[![Pentest](https://github.com/MarRothm/burndown/actions/workflows/pentest.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/pentest.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Project burndowns from InvoiceNinja — as a self-hosted Portainer stack.
Includes an optional AI-generated dashboard powered by the Ollama instance running on the Docker host.

## Prerequisites

- Docker + Docker Compose (or Portainer)
- Running InvoiceNinja instance with API access
- InvoiceNinja project **Custom Field 2** configured as a date field — used to store the project cancellation/early-end date
- (Optional, for the AI dashboard) [Ollama](https://ollama.com) running on the Docker host with the model installed:
  `ollama pull qwen2.5:7b` (~4.7 GB, ~8 GB free RAM). The stack does not bundle or pull a model.
- (Optional) Traefik with `traefik_proxy` network for HTTPS

## Quick Start

### Portainer deployment (production)

Images are built automatically by GitHub Actions on every push to `master` and published
to `ghcr.io`. Deploy the stack in Portainer using `docker-compose.yml` — images are pulled
from the registry; no local build is required.

Portainer runs on the local network only and is not reachable from GitHub. After a new
image build, redeploy manually in Portainer: **Stacks → burndown → Update the stack** with
**Re-pull image and redeploy** enabled.

For the AI dashboard, run `ollama pull qwen2.5:7b` on the Docker host **before** redeploying
(see [Host Ollama](#host-ollama)).

### Local development

```bash
# 1. Create env file
cp .env.example .env
# → fill .env with your values (see below)

# 2. Build and start from local source (uses docker-compose.dev.yml overlay)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
# → AI dashboard needs Ollama on this machine with qwen2.5:7b (ollama pull qwen2.5:7b)

# 3. Open browser
# http://localhost:6088  (or your domain)
```

## Environment Variables (.env)

| Variable                 | Required | Description                                              |
|--------------------------|----------|----------------------------------------------------------|
| `POSTGRES_PASSWORD`      | ✅       | Secure password for PostgreSQL                           |
| `INVOICENINJA_URL`       | ✅       | URL of your InvoiceNinja instance                        |
| `INVOICENINJA_API_KEY`   | ✅       | API token from InvoiceNinja → Settings                   |
| `DOMAIN`                 | —        | Domain for Traefik (e.g. `burndown.example.com`)         |
| `SYNC_INTERVAL_MINUTES`  | —        | Sync interval in minutes (default: `10`)                 |
| `POSTGRES_DB`            | —        | DB name (default: `burndown`)                            |
| `POSTGRES_USER`          | —        | DB user (default: `burndown`)                            |
| `OLLAMA_URL`             | —        | Host Ollama base URL (default: `http://host.docker.internal:11434`); example override: `http://macmini.local:11434` |
| `OLLAMA_MODEL`           | —        | Model for AI dashboard generation (default: `qwen2.5:7b`); must be installed on the host Ollama |

## Architecture

```
InvoiceNinja API
      │
      ▼
  Sync Worker (Node.js)   ← runs every N minutes (projects, tasks, invoices)
      │
      ▼
  PostgreSQL  ←→  Redis (Cache)
      │
      ▼
  API (Fastify)  ←──────────────  Host Ollama (qwen2.5:7b, outside the stack)
      │                                   ▲
      ▼                           api/dashboard.declaration.md
  Frontend (React + Recharts)
      │
      ▼
  Nginx → Browser
```

## Services

| Service    | Description                                                |
|------------|------------------------------------------------------------|
| `postgres` | Primary database                                           |
| `redis`    | Cache + job queue                                          |
| `api`      | REST API (Fastify, port 3000 internal)                     |
| `worker`   | Sync worker (InvoiceNinja → PostgreSQL)                    |
| `frontend` | React SPA via Nginx (port 80)                              |

## API Endpoints

```
GET  /api/health                    → Status
GET  /api/projects                  → All projects with stats (incl. billing_mode, lump_sum)
GET  /api/projects/:id/burndown     → Burndown data for a project
GET  /api/projects/:id/timesheet?month=YYYY-MM → Daily totals of completed hours for one month
GET  /api/projects/:id/turnover     → Invoiced / paid / open per invoice year for a project
GET  /api/turnover?year=YYYY        → Invoiced / paid / open per project for one year
POST /api/sync                      → Trigger manual sync (returns projects, entries, invoices counts)
GET  /api/ai-dashboard              → AI-generated dashboard layout (SSE stream)
GET  /api/ai-dashboard/status       → Host Ollama status: ready | model_missing | unavailable
GET  /api/ai-dashboard/config       → Parsed thresholds from declaration (used by frontend)
PUT  /api/ai-dashboard/declaration  → Update declaration at runtime (body: { content: "…" })
GET  /api/ai-dashboard/debug        → Full AI diagnostic (Ollama status, declaration, projects)
```

## Timesheet

A monthly timesheet per project lists one total of booked time per calendar day, to transfer
hours into other systems (customer portals, time-tracking tools, spreadsheets).

- Open it with the **▦** icon on any project card in the sidebar (legacy and AI mode) or the
  **▦ Timesheet** button in the project header.
- Navigate months with **‹ / ›** (up to the current month). Days without bookings show `0`,
  weekends are shaded.
- Rows are grouped by ISO week (Mon–Sun) with a **weekly subtotal** after each Sunday, for
  weekly transfers. Weeks crossing the month boundary show the neighbouring month's days greyed
  out and count the full week ("incl. days from other month"). Subtotals are display-only —
  they are not part of Copy month or the CSV.
- **Copy month** copies tab-separated `date ⇥ hours` lines — paste into a spreadsheet as two columns.
  Click a single value to copy only that day.
- **Download CSV** saves `timesheet_<project>_<YYYY-MM>.csv` (header `date,hours`, UTF-8).
- The footer total and every weekly subtotal also show the **EUR equivalent** at the project's
  **task rate** (set on the project in InvoiceNinja), e.g. `@ 95.00 €/h · 3,562.50 €`. Amounts are
  net (no VAT), computed from unrounded hours and display-only — not part of Copy month or the
  CSV. Projects without a task rate show `—` and "No hour rate set".
- Toggle **1.75 / 1:45** for decimal hours or hours:minutes; the choice is remembered per browser.
- Only completed time entries count (same rule as the burndown); data is as of the last sync.

## Turnover

Invoices are synced from InvoiceNinja alongside projects and tasks, to show turnover per project
and calendar year.

- The project detail view (legacy mode) has a **Turnover** table: one row per invoice year,
  newest first, with **Invoiced**, **Paid** and **Open**, plus a total row. Projects without
  invoices show "No invoices yet".
- **€ Turnover** in the sidebar (legacy and AI mode) opens an overview of all projects for one
  year (‹ / › to change year), sorted by invoiced amount with a total row. Click a project to
  open its detail view.
- Amounts are **gross** (incl. VAT). Payments count in the **year of the invoice** they pay
  (InvoiceNinja's "paid to date", net of refunds; applied credits count as paid), so
  Paid + Open = Invoiced for every year.
- Counted: invoices with status sent, partial or paid, including archived ones. Not counted:
  drafts, cancelled, reversed and deleted invoices, and invoices without a project.
- The `invoices` table is created automatically when the API or worker starts, also on existing
  databases. The first sync after upgrading fetches all invoices.

## Lump-sum projects (Pauschalabrechnung)

Projects billed by lump sums for reached goals (instead of time spent) are marked in InvoiceNinja
with the project tag **Pauschalabrechnung**:

1. Settings → Tags ("Stichworte"): create the tag `Pauschalabrechnung`, type **Project**, and assign
   it to the project. Matching ignores case and surrounding spaces; other tags are ignored.
2. Settings → Custom fields → Projects:
   - **Custom field 3 – "Vereinbarte Pauschale"**: agreed lump sum. German or English number
     formats are accepted (`10.000,00`, `10,000.00`, `10'000`, `10000`). A single separator
     followed by three digits is a thousands separator (`1.500` = 1500).
   - **Custom field 4 – "Projektwährung"**: currency code of the lump sum (e.g. `CHF`); empty = EUR.
   - Custom field 2 keeps its meaning (actual end date).

What changes for a lump-sum project (after the next sync):

| View | Hourly project (unchanged) | Lump-sum project |
|------|----------------------------|------------------|
| Project card | Hours, budget, progress % | `LUMP SUM` badge, agreed lump sum, **earned %** (no timesheet icon) |
| Project detail | Hour stats, burndown chart, Timesheet button, turnover | Agreed / Invoiced / Earned, turnover — no burndown, no timesheet |
| AI Dashboard | Card, burndown, timesheet summary | Lump-sum card, then the project turnover instead of burndown / timesheet |
| Turnover overview | included | included — totals are unaffected by the billing mode |

**Earned %** = invoiced (all years; same counting rules as the Turnover table) ÷ agreed lump sum,
rounded to whole percent; it can exceed 100 %. Without an agreed lump sum the card shows
"Lump sum not set". Invoices are assumed to be in the project currency (no conversion).

`GET /api/projects` returns per project `billing_mode` (`"hourly"` | `"lump_sum"`) and `lump_sum`
(`{ agreed, currency, invoiced, earned_pct }`, or `null` for hourly projects).

Adding or removing the tag in InvoiceNinja updates the project, so the regular sync picks it up.
If a project was tagged before an InvoiceNinja version with tag support and still shows as hourly,
force a full project resync:

```bash
docker compose exec postgres psql -U burndown -d burndown \
  -c "UPDATE sync_state SET last_synced_at = 'epoch' WHERE resource = 'projects';"
curl -X POST http://localhost:6088/api/sync
```

## AI Dashboard

The AI dashboard generates a live project overview from a plain-language declaration
file, streamed token-by-token from the Ollama instance on the Docker host.

### Switching Views

A toggle in the navigation bar switches between the **legacy dashboard** (default) and
the **AI-generated dashboard**. Your preference is remembered across page reloads.
The toggle is disabled when the host Ollama is unreachable or the configured model is not
installed on it (the UI then shows the `ollama pull <model>` command to run on the host).

### Dashboard composition (declaration)

What the AI dashboard shows is defined in plain language in **`api/dashboard.declaration.md`**
(no code). The default:

```
Show the turnover overview for the current year at the top.

Then show all in_progress projects ordered by budget consumed (highest progress percentage first).
Include every project with status "in_progress", even those with 0 hours logged.

For each project show a ProjectCard (which includes a built-in status badge and progress bar),
followed by its BurndownChart and the timesheet summary of the current month.
```

Optional status thresholds can be added as a sentence, e.g. `Status thresholds: at-risk >= 80%, over-budget > 100%.`

After editing the file, commit and push to `master` — GitHub Actions rebuilds the `burndown-api` image; then redeploy the stack in Portainer (see [Portainer deployment](#portainer-deployment-production)).

To change the composition **without** rebuilding, use the API:

```bash
curl -X PUT http://localhost:3000/api/ai-dashboard/declaration \
  -H 'Content-Type: application/json' \
  -d '{"content": "Show the turnover overview for 2025. Then for each in_progress project a ProjectCard and its project turnover."}'
```

The content is stored in `/app/data/dashboard.declaration.md` (Docker volume), takes priority over the
baked-in file, and invalidates the layout cache — the next dashboard load regenerates the layout.
The dashboard builds up live while it is generated; no reload is needed.

### Available Components

Building blocks only appear when the declaration asks for them. The AI composes them in openUI Lang,
root statement first:

```
root   = Dashboard([to, card1, chart1, ts1])
to     = TurnoverOverview()
card1  = ProjectCard(1)
chart1 = BurndownChart(1)
ts1    = TimesheetSummary(1)
```

| Component | Arguments | Displays | Example sentence for the declaration |
|-----------|-----------|----------|--------------------------------------|
| `Dashboard(children)` | array of components | Root container — first statement `root = Dashboard([...])` | — |
| `ProjectCard(projectId)` | project ID | Name, budget, hours logged, remaining, status badge (threshold-driven) | "For each project show a ProjectCard" |
| `BurndownChart(projectId)` | project ID | Ideal vs. actual burndown line chart | "…followed by its BurndownChart" |
| `TimesheetSummary(projectId, month?)` | project ID, `"YYYY-MM"` | Month total of booked hours, hour rate and EUR; click opens the full timesheet (copy / CSV) | "…and the timesheet summary of the current month" / "…timesheet for October 2026" |
| `ProjectTurnover(projectId)` | project ID | Invoiced / paid / open per year for the project | "…also show the project turnover for each project" |
| `TurnoverOverview(year?)` | year | Cross-project invoiced / paid / open for one year | "Show the turnover overview for the current year at the top" / "…for 2025" |
| `StatusBadge` | — | Embedded inside ProjectCard; thresholds set by declaration | — |

**Lump-sum projects**: `BurndownChart(n)` shows the project turnover instead, `TimesheetSummary(n)`
is skipped, and `ProjectCard(n)` shows agreed lump sum and earned % — whatever the declaration says.
The AI layout is regenerated when a project's billing mode changes.

Without a month or year, the blocks use the **current** month / year, resolved when the dashboard is
displayed (a cached layout therefore never shows a stale month). Amounts are the same as in the
Timesheet and Turnover views (gross, incl. VAT for turnover).

### Host Ollama

The stack does not bundle an AI runtime. The `api` service talks to the Ollama that already
runs on the Docker host (shared with any other project on that machine), via
`http://host.docker.internal:11434`:

- On macOS (Docker Desktop / OrbStack) `host.docker.internal` reaches the Mac directly, even
  if Ollama listens on loopback only.
- On Linux Docker Engine (≥ 20.10) the `extra_hosts: host.docker.internal:host-gateway` entry
  on the `api` service provides the name; Ollama must then listen on an address reachable
  from the Docker bridge (`OLLAMA_HOST`).

Host prerequisites:

```bash
ollama pull qwen2.5:7b             # or your OLLAMA_MODEL — the stack never pulls models
ollama list | grep 'qwen2.5:7b'    # exact tag must be present
```

To reach Ollama on another address, set `OLLAMA_URL` in the stack environment (e.g.
`OLLAMA_URL=http://macmini.local:11434`) — no rebuild needed. `GET /api/ai-dashboard/debug`
shows the address in use. Note: mDNS names (`*.local`) often do **not** resolve inside
containers — if the status stays `unavailable`, use the host's IP address instead. On macOS
the container runtime (Docker Desktop / OrbStack) may also need the *Local Network*
permission to reach other machines on the LAN.

Use `qwen2.5:7b` (or another non-reasoning model): "thinking" models such as `qwen3-vl:8b`
spend most of the 30 s generation timeout on hidden reasoning tokens and time out.

### Upgrading from the bundled Ollama container

Earlier versions shipped an `ollama` service with its own model copy. After redeploying,
remove the leftovers on the Docker host to free ~5 GB:

```bash
docker rm -f burndown_ollama 2>/dev/null
docker volume ls | grep ollama_data
docker volume rm <stack>_ollama_data
```

## CI/CD

Docker images are built and published automatically via GitHub Actions on every push to `master`.
Images are multi-arch (`linux/amd64` and `linux/arm64`), so they run on Intel hosts and on Apple
Silicon hosts such as the Mac mini running Portainer.

### GitHub Secrets required

None. Registry authentication uses the built-in `GITHUB_TOKEN`. Ensure the workflow has `packages: write` permission — this is already set in `.github/workflows/build-and-push.yml`.

### Images published

| Image | Registry |
|-------|----------|
| `burndown-postgres` | `ghcr.io/marrothm/burndown-postgres:latest` |
| `burndown-api` | `ghcr.io/marrothm/burndown-api:latest` |
| `burndown-frontend` | `ghcr.io/marrothm/burndown-frontend:latest` |

The `worker` service reuses the `burndown-api` image (same binary, different entry point command). Redis uses the official `redis:7-alpine` upstream image and is not rebuilt by this pipeline.

### Deployment flow

```
git push origin master
       │
       ▼
GitHub Actions builds 4 images → pushes to ghcr.io
       │
       ▼
Manual redeploy in local Portainer (Re-pull image and redeploy)
       │
       ▼
Portainer pulls new images → redeploys stack
```

## Burndown Logic

- **Budget**: `project.budgeted_hours` from InvoiceNinja
- **Scope**: hourly projects only — lump-sum projects have no burndown (see *Lump-sum projects*)
- **Ideal line**: Linear from `budgeted_hours` to 0 between start and end date
- **Actual line**: `budgeted_hours - Σ completed time entries` cumulated
- **Corrections**: Retroactive changes to time entries affect the entire history (no snapshot locking)

## Running without Traefik

Remove the `labels` from the `frontend` service in `docker-compose.yml` and expose a port:

```yaml
frontend:
  ports:
    - "6088:80"
  networks:
    - internal   # remove proxy network
```

And remove the `proxy` network from the networks section.
