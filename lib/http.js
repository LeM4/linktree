import fs from 'fs';
import path from 'path';
import fastify from 'fastify';
import ejs from 'ejs';
import fastifyView from '@fastify/view';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import config from './config.js';

function assetVersion() {
  try {
    return Math.floor(fs.statSync(path.join(config.publicDir, 'styles.css')).mtimeMs).toString(36);
  } catch {
    return 'dev';
  }
}

/** Fastify instance with the plugins shared by the public and admin servers. */
export function createApp({ name, bodyLimit = 1024 * 1024, frameOptions = 'DENY', logger } = {}) {
  const app = fastify({
    logger: logger ?? { level: config.logLevel, base: { app: name } },
    trustProxy: config.trustProxy,
    bodyLimit,
  });

  const version = assetVersion();

  app.register(fastifyCookie);
  app.register(fastifyFormbody, { bodyLimit });
  app.register(fastifyView, {
    engine: { ejs },
    root: config.viewsDir,
    defaultContext: {
      asset: (file) => `/static/${file}?v=${version}`,
      // JSON that is safe to embed inside <script> tags.
      json: (value) =>
        JSON.stringify(value ?? null)
          .replace(/</g, '\\u003c')
          .replace(/\u2028/g, '\\u2028')
          .replace(/\u2029/g, '\\u2029'),
    },
  });
  app.register(fastifyStatic, {
    root: config.publicDir,
    prefix: '/static/',
    maxAge: '7d',
    index: false,
  });

  app.addHook('onSend', async (request, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Frame-Options', frameOptions);
    return payload;
  });

  app.get('/healthz', async () => ({ ok: true }));
  app.get('/favicon.ico', (request, reply) => reply.redirect('/static/favicon.png', 301));

  return app;
}

export async function listen(app, port) {
  try {
    await app.listen({ port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}
