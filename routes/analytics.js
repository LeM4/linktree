import { getAnalytics } from '../lib/analytics_db.js';
import { addFilter, removeFilter, parseFilterParam, UNKNOWN } from '../lib/view-helpers.js';

async function analyticsRoutes(fastify) {
  fastify.get('/analytics', async (request, reply) => {
    const filters = {
      excludedLinks: parseFilterParam(request.query.excludedLinks),
      excludedCountries: parseFilterParam(request.query.excludedCountries),
      excludedReferrers: parseFilterParam(request.query.excludedReferrers),
    };
    const unknownToEmpty = (list) => list.map((v) => (v === UNKNOWN ? '' : v));
    const dbFilters = {
      ...filters,
      excludedCountries: unknownToEmpty(filters.excludedCountries),
      excludedReferrers: unknownToEmpty(filters.excludedReferrers),
    };

    reply.header('Cache-Control', 'no-store');
    return reply.view('analytics', {
      page: 'analytics',
      analyticsData: getAnalytics(dbFilters),
      filters,
      hasFilters: Object.values(filters).some((list) => list.length > 0),
      addFilter: (key, value) => addFilter(request.query, key, value),
      removeFilter: (key, value) => removeFilter(request.query, key, value),
    });
  });
}

export default analyticsRoutes;
