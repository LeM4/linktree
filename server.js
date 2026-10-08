import config from './lib/config.js';
import { createApp, listen } from './lib/http.js';
import { initDatabases } from './lib/setup.js';
import publicRoutes from './routes/public.js';

export function buildPublicApp(options = {}) {
  const app = createApp({ name: 'public', frameOptions: 'SAMEORIGIN', ...options });
  app.register(publicRoutes);
  return app;
}

export function startPublic() {
  return listen(buildPublicApp(), config.port);
}

if (import.meta.main) {
  initDatabases();
  startPublic();
}
