import fastify from 'fastify';
import path from 'path';
import { fileURLToPath } from 'url';
import ejs from 'ejs';
import fastifyView from '@fastify/view';
import fastifyStatic from '@fastify/static';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = fastify({ logger: true });

// Register static file server
app.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/public/',
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

// Start the server
const start = async () => {
  try {
    await app.listen({ port: 3001 });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
