import { initDatabases } from './lib/setup.js';
import { startPublic } from './server.js';
import { startAdmin } from './admin-server.js';

// Runs the public site and the admin dashboard in one process (used by Docker).
initDatabases();
await Promise.all([startPublic(), startAdmin()]);
