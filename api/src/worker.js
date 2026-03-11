import 'dotenv/config';
import cron from 'node-cron';
import { runFullSync } from './services/sync.js';

const intervalMinutes = parseInt(process.env.SYNC_INTERVAL_MINUTES ?? '10');

console.log(`[worker] Starting sync worker, interval: ${intervalMinutes} min`);

// Run immediately on startup
runFullSync().catch(err => console.error('[worker] Initial sync failed:', err.message));

// Schedule recurring sync
cron.schedule(`*/${intervalMinutes} * * * *`, () => {
  runFullSync().catch(err => console.error('[worker] Sync failed:', err.message));
});

console.log(`[worker] Cron scheduled: every ${intervalMinutes} minutes`);
