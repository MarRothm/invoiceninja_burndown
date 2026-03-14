# Burndown Stack

[![Tests](https://github.com/MarRothm/burndown/actions/workflows/test.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Project burndowns from InvoiceNinja — as a self-hosted Portainer stack.

## Prerequisites

- Docker + Docker Compose (or Portainer)
- Running InvoiceNinja instance with API access
- (Optional) Traefik with `traefik_proxy` network for HTTPS

## Quick Start

```bash
# 1. Create env file
cp .env.example .env
# → fill .env with your values (see below)

# 2. Start stack
docker compose up -d --build

# 3. Open browser
# http://localhost  (or your domain)
```

## Environment Variables (.env)

| Variable                 | Required | Description                                        |
|--------------------------|----------|----------------------------------------------------|
| `POSTGRES_PASSWORD`      | ✅       | Secure password for PostgreSQL                     |
| `INVOICENINJA_URL`       | ✅       | URL of your InvoiceNinja instance                  |
| `INVOICENINJA_API_KEY`   | ✅       | API token from InvoiceNinja → Settings             |
| `DOMAIN`                 | —        | Domain for Traefik (e.g. `burndown.example.com`)   |
| `SYNC_INTERVAL_MINUTES`  | —        | Sync interval in minutes (default: 10)             |
| `POSTGRES_DB`            | —        | DB name (default: `burndown`)                      |
| `POSTGRES_USER`          | —        | DB user (default: `burndown`)                      |

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
  API (Fastify)
      │
      ▼
  Frontend (React + Recharts)
      │
      ▼
  Nginx → Browser
```

## Services

| Service    | Description                               |
|------------|-------------------------------------------|
| `postgres` | Primary database                          |
| `redis`    | Cache + job queue                         |
| `api`      | REST API (Fastify, port 3000 internal)    |
| `worker`   | Sync worker (InvoiceNinja → PostgreSQL)   |
| `frontend` | React SPA via Nginx (port 80)             |

## API Endpoints

```
GET  /api/health                    → Status
GET  /api/projects                  → All projects with stats
GET  /api/projects/:id/burndown     → Burndown data for a project
POST /api/sync                      → Trigger manual sync
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
    - "8080:80"
  networks:
    - internal   # remove proxy network
```

And remove the `proxy` network from the networks section.
