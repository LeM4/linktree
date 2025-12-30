import fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import fastifyView from '@fastify/view';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({ logger: true, trustProxy: true });

// Register cookie plugin
app.register(fastifyCookie);

// Register formbody plugin
app.register(fastifyFormbody);

// Register static file server
app.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
});

// Register the view engine
app.register(fastifyView, {
  engine: {
    ejs: ejs,
  },
  root: path.join(__dirname, 'views'),
});

// Register admin routes
app.register(adminRoutes);
app.register(analyticsRoutes);

// Manually serve styles.css
app.get('/styles.css', (req, reply) => {
    const fs = require('fs');
    const css = fs.readFileSync(path.join(__dirname, 'public', 'styles.css'), 'utf8');
    reply.header('Content-Type', 'text/css').send(css);
});

// Serve favicon manually
app.get('/favicon.png', (req, reply) => {
    reply.sendFile('favicon.png');
});

// Start the server
const start = async () => {
  try {
    await app.listen({
      port: 3001,
      host: process.env.HOST ?? '0.0.0.0'
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
