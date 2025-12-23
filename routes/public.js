import { getVisibleLinks } from '../lib/db.js';
import { getCountry } from '../lib/geo.js';

async function publicRoutes(fastify, options) {
  fastify.get('/', async (request, reply) => {
    const country = getCountry(request);
    const links = getVisibleLinks(country);
    return reply.view('linktree', { links: links });
  });
}

export default publicRoutes;
