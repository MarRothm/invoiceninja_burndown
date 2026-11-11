import 'dotenv/config';
import cron from 'node-cron';
import { runFullSync } from './services/sync.js';
import { ensureSchema } from './db/schema.js';

const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES ?? '10');

console.log(`[worker] Starting sync worker, interval: ${intervalMinutes} min`);

try {
  await ensureSchema();
} catch (err) {
  console.error('[schema] Failed to apply schema:', err.message);
  process.exit(1);
}

// Run immediately on startup
runFullSync().catch(err => console.error('[worker] Initial sync failed:', err.message));

// Schedule recurring sync
cron.schedule(`*/${intervalMinutes} * * * *`, () => {
  runFullSync().catch(err => console.error('[worker] Sync failed:', err.message));
});

console.log(`[worker] Cron scheduled: every ${intervalMinutes} minutes`);
