-- ─────────────────────────────────────────────
--  Burndown Stack  –  Datenbankschema
--  Wird beim ersten Start automatisch ausgeführt
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id                  SERIAL PRIMARY KEY,
  invoiceninja_id     VARCHAR(50) UNIQUE NOT NULL,
  name                VARCHAR(255) NOT NULL,
  budgeted_hours      NUMERIC(10, 2) NOT NULL DEFAULT 0,
  deadline            DATE,
  start_date          DATE,
  archived_at         TIMESTAMPTZ,
  actual_end_date     DATE,
  raw                 JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: Spalten nachrüsten falls Tabelle bereits existiert
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS actual_end_date DATE;

CREATE TABLE IF NOT EXISTS time_entries (
  id                    SERIAL PRIMARY KEY,
  invoiceninja_task_id  VARCHAR(50) NOT NULL,
  project_id            INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  hours                 NUMERIC(8, 2) NOT NULL DEFAULT 0,
  entry_date            DATE NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'completed',
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Primär-Index für Burndown-Abfragen
CREATE INDEX IF NOT EXISTS idx_time_entries_project_date
  ON time_entries (project_id, entry_date)
  WHERE status = 'completed';

-- Index für schnelles Löschen per Task-ID beim Re-Sync
CREATE INDEX IF NOT EXISTS idx_time_entries_task_id
  ON time_entries (invoiceninja_task_id);

-- Sync-Cursor
CREATE TABLE IF NOT EXISTS sync_state (
  resource        VARCHAR(50) PRIMARY KEY,
  last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01'
);

INSERT INTO sync_state (resource)
VALUES ('projects'), ('time_entries')
ON CONFLICT DO NOTHING;
