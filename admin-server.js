import config from './lib/config.js';
import { createApp, listen } from './lib/http.js';
import { initDatabases } from './lib/setup.js';
import { basicAuth, sameOrigin } from './lib/auth.js';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';

export function buildAdminApp(options = {}) {
  const { username, password, authDisabled } = config.admin;
  if (!password && !authDisabled) {
    throw new Error(
      'ADMIN_PASSWORD (or ADMIN_PASSWORD_FILE) must be set. ' +
        'Set ADMIN_AUTH_DISABLED=true only if the admin port is protected some other way.'
    );
  }

  const app = createApp({ name: 'admin', bodyLimit: 5 * 1024 * 1024, ...options });
  if (authDisabled) {
    app.log.warn('Admin authentication is DISABLED – never expose this port publicly.');
  } else {
    app.addHook('onRequest', basicAuth({ username, password, publicPaths: ['/healthz'] }));
  }
  app.addHook('onRequest', sameOrigin);

  app.register(adminRoutes);
  app.register(analyticsRoutes);
  return app;
}

export function startAdmin() {
  return listen(buildAdminApp(), config.adminPort);
}

if (import.meta.main) {
  initDatabases();
  startAdmin();
}
