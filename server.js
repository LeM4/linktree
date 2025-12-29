import fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import fastifyView from '@fastify/view';
import fastifyCookie from '@fastify/cookie';
import fastifyFormbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import publicRoutes from './routes/public.js';
import { findOrCreateUser, addVisitation, addLinkClick } from './lib/analytics_db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({ logger: true });

// Register cookie plugin
app.register(fastifyCookie);

// Register formbody plugin
app.register(fastifyFormbody);

// Register static file server
app.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/'
});

// Register the view engine
app.register(fastifyView, {
  engine: {
    ejs: ejs,
  },
  root: path.join(__dirname, 'views'),
});

// Register routes
app.register(publicRoutes);

// Analytics tracking route
app.post('/track', async (request, reply) => {
    const { fingerprint, country, referrer, userId } = request.body;
    const user = findOrCreateUser(fingerprint, userId);
    const visitationId = addVisitation(user.id, country, referrer);
    // Store visitationId in a cookie for subsequent link click tracking
    reply.setCookie('visitationId', visitationId, { path: '/' });
    return { ok: true, userId: user.id };
});

// Link click tracking route
app.post('/track-click', async (request, reply) => {
    const { linkUrl } = request.body;
    const visitationId = request.cookies.visitationId;
    if (visitationId) {
        addLinkClick(visitationId, linkUrl);
    }
    // Instruct htmx to redirect to the actual link URL
    reply.header('HX-Redirect', linkUrl);
    return reply.send('');
});


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

// Serve fingerprintJS manually
app.get('/fp.umd.min.js', (req, reply) => {
    reply.sendFile('fp.umd.min.js');
});

// Start the server
const start = async () => {
  try {
    await app.listen({
      port: 3000,
      host: process.env.HOST ?? '0.0.0.0'
    });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
