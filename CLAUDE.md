# Burndown Stack

## Projektbeschreibung
Projekt-Burndown-Dashboard. Daten kommen aus InvoiceNinja per API.
Läuft lokal via Docker Compose.

## Architektur
- **api/src/server.js** – Node.js + Fastify, REST API (Port 3000 intern)
- **api/src/worker.js** – Sync-Worker, pollt InvoiceNinja alle N Minuten
- **api/src/services/sync.js** – Sync-Logik (InvoiceNinja → PostgreSQL)
- **api/src/services/burndown.js** – Burndown-Berechnungslogik
- **api/src/services/invoiceninja.js** – InvoiceNinja API-Client
- **api/src/routes/projects.js** – API-Routen
- **frontend/** – React + Vite + Recharts (via Nginx, Port 80)
- Datenbank: PostgreSQL (Schema in `init.sql`)
- Cache: Redis

## API-Endpunkte
```
GET  /api/health                    → Status
GET  /api/projects                  → Alle Projekte mit Stats
GET  /api/projects/:id/burndown     → Burndown-Daten für ein Projekt
POST /api/sync                      → Manuellen Sync auslösen
```

## Wichtige Designentscheidungen
- Nur **abgeschlossene** Time Entries fließen in den Burndown ein (end > 0)
- `budgeted_hours` kommt direkt aus dem InvoiceNinja-Projekt
- Kein Snapshot-System – nachträgliche Korrekturen wirken rückwirkend
- Burndown = budgeted_hours minus kumulierte completed time_entries
- Time Entries kommen aus `task.time_log` ([start_unix, end_unix] Paare)
- Bei Re-Sync: delete + re-insert per Task-ID (keine partielle Aktualisierung)
- Ideal-Linie: linear von `budgeted_hours` auf 0 zwischen Start- und Enddatum
- Actual-Linie endet am heutigen Tag (future dates = null)
- Kein Traefik – läuft nur auf localhost

## Stack starten
```bash
cp .env.example .env
# .env mit echten Werten befüllen
docker compose up -d --build
# Frontend: http://localhost
```

## Umgebungsvariablen (.env)
Vorlage: `.env.example`
- `INVOICENINJA_URL` + `INVOICENINJA_API_KEY` – Pflicht
- `POSTGRES_PASSWORD` – Pflicht
- `SYNC_INTERVAL_MINUTES` – Standard: 10
