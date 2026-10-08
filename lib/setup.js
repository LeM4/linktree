import { initDb, seedSampleLinks } from './db.js';
import { initAnalyticsDb } from './analytics_db.js';

/** Creates/migrates both databases; seeds sample links on a brand-new install. */
export function initDatabases({ seed = process.env.SEED_SAMPLE_LINKS !== 'false' } = {}) {
  const fresh = initDb();
  if (fresh && seed) seedSampleLinks();
  initAnalyticsDb();
  return { fresh };
}
