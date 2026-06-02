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

```bash
# 1. Create env file
cp .env.example .env
# → fill .env with your values (see below)

# 2. Start stack
docker compose up -d --build
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
      ▼                           dashboard.declaration.md
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
```

## AI Dashboard

The AI dashboard generates a live project overview from a plain-language declaration
file, streamed token-by-token from a local Ollama model.

### Switching Views

A toggle in the navigation bar switches between the **legacy dashboard** (default) and
the **AI-generated dashboard**. Your preference is remembered across page reloads.
The toggle is disabled when Ollama is unavailable or the model is still being pulled.

### Customising the Layout

Edit `dashboard.declaration.md` at the repository root — plain prose, no code:

```
Show all active projects ordered by budget consumed (highest first).
For each project, show a ProjectCard with name, budgeted hours, hours used, and remaining hours.
Add a StatusBadge: over-budget for >100%, at-risk for 80–100%, on-budget otherwise.
Below each card, show a BurndownChart.
```

After saving, reload the AI dashboard — the layout updates automatically (no rebuild needed).

### Available Components

The AI model composes layouts using three registered components:

| Component | Props | Displays |
|-----------|-------|---------|
| `<ProjectCard projectId="N" />` | project ID | Name, budget, hours logged, hours remaining |
| `<BurndownChart projectId="N" />` | project ID | Ideal vs. actual burndown line chart |
| `<StatusBadge status="…" />` | `on-budget` / `at-risk` / `over-budget` | Colour-coded budget health badge |

### Sharing Ollama with Other Projects

If another project (e.g. Monatsabschluss) also runs Ollama on the same host, point both
stacks at a single shared Ollama container to avoid pulling the model twice:

```dotenv
# .env
OLLAMA_URL=http://host-gateway:11434
```

Then remove the `ollama` service from `docker-compose.yml`.

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
