# Burndown Stack

[![Tests](https://github.com/MarRothm/burndown/actions/workflows/test.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/test.yml)
[![Pentest](https://github.com/MarRothm/burndown/actions/workflows/pentest.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/pentest.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Project burndowns from InvoiceNinja — as a self-hosted Portainer stack.
Includes an optional AI-generated dashboard powered by a local Ollama model.

## Prerequisites

- Docker + Docker Compose (or Portainer)
- Running InvoiceNinja instance with API access
- InvoiceNinja project **Custom Field 2** configured as a date field — used to store the project cancellation/early-end date
- ~8 GB free RAM on the host if using the AI dashboard (for `qwen2.5:7b` via Ollama)
- (Optional) Traefik with `traefik_proxy` network for HTTPS

## Quick Start

### Portainer deployment (production)

Images are built automatically by GitHub Actions on every push to `master` and published
to `ghcr.io`. Deploy the stack in Portainer using `docker-compose.yml` — images are pulled
from the registry; no local build is required.

On first start, Ollama pulls `qwen2.5:7b` (~5 GB). Subsequent starts are instant.

### Local development

```bash
# 1. Create env file
cp .env.example .env
# → fill .env with your values (see below)

# 2. Build and start from local source (uses docker-compose.dev.yml overlay)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
# → first run: Ollama pulls qwen2.5:7b (~5 GB); subsequent starts are instant

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
| `OLLAMA_URL`             | —        | Ollama base URL (default: `http://ollama:11434`); override to use a shared external Ollama instance |
| `OLLAMA_MODEL`           | —        | Model for AI dashboard generation (default: `qwen2.5:7b`) |

## Architecture

```
InvoiceNinja API
      │
      ▼
  Sync Worker (Node.js)   ← runs every N minutes
      │
      ▼
  PostgreSQL  ←→  Redis (Cache)
      │
      ▼
  API (Fastify)  ←──────────────  Ollama (qwen2.5:7b)
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
| `ollama`   | Local AI runtime — serves `qwen2.5:7b` for AI dashboard generation (port 11434 internal only) |

## API Endpoints

```
GET  /api/health                    → Status
GET  /api/projects                  → All projects with stats
GET  /api/projects/:id/burndown     → Burndown data for a project
POST /api/sync                      → Trigger manual sync
GET  /api/ai-dashboard              → AI-generated dashboard layout (SSE stream)
GET  /api/ai-dashboard/status       → Ollama availability + model status
GET  /api/ai-dashboard/config       → Parsed thresholds from declaration (used by frontend)
PUT  /api/ai-dashboard/declaration  → Update declaration at runtime (body: { content: "…" })
GET  /api/ai-dashboard/debug        → Full AI diagnostic (Ollama status, declaration, projects)
```

## AI Dashboard

The AI dashboard generates a live project overview from a plain-language declaration
file, streamed token-by-token from a local Ollama model.

### Switching Views

A toggle in the navigation bar switches between the **legacy dashboard** (default) and
the **AI-generated dashboard**. Your preference is remembered across page reloads.
The toggle is disabled when Ollama is unavailable or the model is still being pulled.

### Customising the Layout

Edit `api/dashboard.declaration.md` — plain prose, no code:

```
Show all in_progress projects ordered by budget consumed (highest progress percentage first).
Include every project with status "in_progress", even those with 0 hours logged.

For each project show a ProjectCard (which includes a built-in status badge and progress bar)
followed by a BurndownChart below it.

Status thresholds: at-risk >= 80%, over-budget > 100%.
```

After saving the file, commit and push to `master` — GitHub Actions rebuilds the `burndown-api` image and triggers the Portainer webhook automatically.

To update the declaration **without** rebuilding, use the API:

```bash
curl -X PUT http://localhost:3000/api/ai-dashboard/declaration \
  -H 'Content-Type: application/json' \
  -d '{"content": "Show all in_progress projects ordered by budget consumed..."}'
```

The new content is persisted to a Docker volume and takes effect on the next dashboard load (cache is invalidated automatically).

### Available Components

The AI model composes layouts using openUI Lang function-call syntax:

```
card1  = ProjectCard(1)
chart1 = BurndownChart(1)
root   = Dashboard([card1, chart1])
```

| Component | Argument | Displays |
|-----------|----------|---------|
| `Dashboard(children)` | array of components | Root container — every layout must end with `root = Dashboard([...])` |
| `ProjectCard(projectId)` | project ID (number) | Name, budget, hours logged, remaining, status badge (threshold-driven) |
| `BurndownChart(projectId)` | project ID (number) | Ideal vs. actual burndown line chart |
| `StatusBadge` | — | Embedded inside ProjectCard; thresholds set by declaration |

### Sharing Ollama with Other Projects

If another project (e.g. Monatsabschluss) also runs Ollama on the same host, point both
stacks at a single shared Ollama container to avoid pulling the model twice:

```dotenv
# .env
OLLAMA_URL=http://host-gateway:11434
```

Then remove the `ollama` service from `docker-compose.yml`.

## CI/CD

Docker images are built and published automatically via GitHub Actions on every push to `master`.

### GitHub Secrets required

| Secret | Description |
|--------|-------------|
| `PORTAINER_WEBHOOK_URL` | Portainer stack webhook URL — called after every successful image push to trigger immediate redeploy |

> **Note**: Registry authentication uses the built-in `GITHUB_TOKEN` (no manual secret needed). Ensure the workflow has `packages: write` permission — this is already set in `.github/workflows/build-and-push.yml`.

### Images published

| Image | Registry |
|-------|----------|
| `burndown-postgres` | `ghcr.io/marrothm/burndown-postgres:latest` |
| `burndown-ollama` | `ghcr.io/marrothm/burndown-ollama:latest` |
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
POST $PORTAINER_WEBHOOK_URL
       │
       ▼
Portainer pulls new images → redeploys stack
```

## Burndown Logic

- **Budget**: `project.budgeted_hours` from InvoiceNinja
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
