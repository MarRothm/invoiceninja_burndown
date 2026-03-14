# Burndown Stack

[![Tests](https://github.com/MarRothm/burndown/actions/workflows/test.yml/badge.svg)](https://github.com/MarRothm/burndown/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Projekt-Burndowns aus InvoiceNinja — als eigener Portainer Stack.

## Voraussetzungen

- Docker + Docker Compose (oder Portainer)
- Laufende InvoiceNinja-Instanz mit API-Zugang
- (Optional) Traefik mit `traefik_proxy` Netzwerk für HTTPS

## Schnellstart

```bash
# 1. Env-Datei anlegen
cp .env.example .env
# → .env mit deinen Werten befüllen (siehe unten)

# 2. Stack starten
docker compose up -d --build

# 3. Browser öffnen
# http://localhost  (oder deine Domain)
```

## Umgebungsvariablen (.env)

| Variable                 | Pflicht | Beschreibung                                  |
|--------------------------|---------|-----------------------------------------------|
| `POSTGRES_PASSWORD`      | ✅      | Sicheres Passwort für PostgreSQL               |
| `INVOICENINJA_URL`       | ✅      | URL deiner InvoiceNinja-Instanz                |
| `INVOICENINJA_API_KEY`   | ✅      | API-Token aus InvoiceNinja → Einstellungen     |
| `DOMAIN`                 | —       | Domain für Traefik (z.B. `burndown.firma.de`)  |
| `SYNC_INTERVAL_MINUTES`  | —       | Sync-Intervall in Minuten (Standard: 10)       |
| `POSTGRES_DB`            | —       | DB-Name (Standard: `burndown`)                 |
| `POSTGRES_USER`          | —       | DB-User (Standard: `burndown`)                 |

## Architektur

```
InvoiceNinja API
      │
      ▼
  Sync Worker (Node.js)   ← läuft alle N Minuten
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

| Service    | Beschreibung                              |
|------------|-------------------------------------------|
| `postgres` | Primäre Datenbank                         |
| `redis`    | Cache + Job-Queue                         |
| `api`      | REST API (Fastify, Port 3000 intern)      |
| `worker`   | Sync-Worker (InvoiceNinja → PostgreSQL)   |
| `frontend` | React SPA via Nginx (Port 80)             |

## API-Endpunkte

```
GET  /api/health                    → Status
GET  /api/projects                  → Alle Projekte mit Stats
GET  /api/projects/:id/burndown     → Burndown-Daten für ein Projekt
POST /api/sync                      → Manuellen Sync auslösen
```

## Burndown-Logik

- **Budget**: `project.budgeted_hours` aus InvoiceNinja
- **Ideal-Linie**: Linear von `budgeted_hours` auf 0 zwischen Start- und Enddatum
- **Actual-Linie**: `budgeted_hours - Σ abgeschlossene Time Entries` kumuliert
- **Korrekturen**: Rückwirkende Änderungen an Time Entries wirken sich auf den gesamten Verlauf aus (kein Snapshot-Locking)

## Ohne Traefik betreiben

In `docker-compose.yml` beim `frontend`-Service die `labels` entfernen und einen Port freigeben:

```yaml
frontend:
  ports:
    - "8080:80"
  networks:
    - internal   # proxy-Netzwerk entfernen
```

Und das `proxy`-Netzwerk aus der Networks-Sektion entfernen.
