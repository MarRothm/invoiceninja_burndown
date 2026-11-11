import { query } from './pool.js';

// init.sql only runs when the postgres volume is first created, so existing deployments
// get tables added after that here. Every statement is idempotent; keep in sync with init.sql.
const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS invoices (
  id                  SERIAL PRIMARY KEY,
  invoiceninja_id     VARCHAR(50) UNIQUE NOT NULL,
  project_id          INT REFERENCES projects(id) ON DELETE SET NULL,
  number              VARCHAR(100),
  invoice_date        DATE,
  amount              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_to_date        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status_id           SMALLINT NOT NULL,
  is_deleted          BOOLEAN NOT NULL DEFAULT false,
  raw                 JSONB,
  synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS idx_invoices_project_date
  ON invoices (project_id, invoice_date)
  WHERE NOT is_deleted AND status_id IN (2, 3, 4)`,
  `INSERT INTO sync_state (resource) VALUES ('invoices') ON CONFLICT DO NOTHING`,
];

/** Apply schema additions missing from databases created by an older init.sql. */
export async function ensureSchema() {
  for (const sql of STATEMENTS) {
    await query(sql);
  }
}
