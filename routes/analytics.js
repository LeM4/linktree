import { getAnalytics } from '../lib/analytics_db.js';

async function analyticsRoutes(fastify, options) {
  fastify.get('/analytics', async (request, reply) => {
    const analyticsData = getAnalytics();
    return reply.view('analytics', { analyticsData: analyticsData });
  });
}

export default analyticsRoutes;
