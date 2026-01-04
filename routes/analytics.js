import { getAnalytics } from '../lib/analytics_db.js';
import { addFilter, removeFilter } from '../lib/view-helpers.js';

async function analyticsRoutes(fastify, options) {
  fastify.get('/analytics', async (request, reply) => {
    const { excludedLinks, excludedCountries, excludedReferrers } = request.query;
    
    const processFilter = (param) => {
        //param = [ "AT,PL", "DE" ]
        if (!param) return [];
        if (Array.isArray(param)) {
            return param.flatMap(p => p.split(','));
        }
        return param.split(',');
    };
    
    const filters = {
      excludedLinks: processFilter(excludedLinks),
      excludedCountries: processFilter(excludedCountries),
      excludedReferrers: processFilter(excludedReferrers),
    };

    console.log('Applied Filters:', filters);

    const analyticsData = getAnalytics(filters);
    
    // Pass helper functions to the template
    const helpers = {
        addFilter: (key, value) => addFilter(request.query, key, value),
        removeFilter: (key, value) => removeFilter(request.query, key, value)
    };

    return reply.view('analytics', { analyticsData, filters, ...helpers });
  });
}

export default analyticsRoutes;
