import fs from 'fs';
import path from 'path';
import { countries as countryData } from 'countries-list';
import config from '../lib/config.js';
import { getLinks } from '../lib/db.js';
import { getStats, RANGES, DEFAULT_RANGE } from '../lib/stats.js';
import { buildInsights } from '../lib/insights.js';
import { addFilter, removeFilter, parseFilterParam, withParams, UNKNOWN } from '../lib/view-helpers.js';
import { isCountryCode } from '../lib/validate.js';

let worldMap;
function loadWorldMap() {
  if (worldMap === undefined) {
    try {
      worldMap = JSON.parse(fs.readFileSync(path.join(config.publicDir, 'data', 'world-map.json'), 'utf8'));
    } catch {
      worldMap = null;
    }
  }
  return worldMap;
}

const countryName = (code) => (code ? countryData[code]?.name || code : 'Unknown');

function prettyUrl(url) {
  try {
    const u = new URL(url);
    return `${u.host.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}

/** sqrt scale so a single big country doesn't wash out everyone else. */
const intensity = (n, max) => (n && max ? Math.round((0.12 + 0.88 * Math.sqrt(n / max)) * 100) / 100 : 0);

async function analyticsRoutes(fastify) {
  fastify.get('/analytics', async (request, reply) => {
    const q = request.query;
    const rangeKey = RANGES[q.range] ? q.range : DEFAULT_RANGE;
    const focusParam = typeof q.country === 'string' ? q.country : '';
    const focus = focusParam === UNKNOWN ? '' : isCountryCode(focusParam) ? focusParam.toUpperCase() : null;
    const unknownToEmpty = (list) => list.map((v) => (v === UNKNOWN ? '' : v));

    const filters = {
      excludedLinks: parseFilterParam(q.excludedLinks),
      excludedCountries: parseFilterParam(q.excludedCountries),
      excludedReferrers: parseFilterParam(q.excludedReferrers),
    };
    const stats = getStats(rangeKey, {
      country: focus,
      excludedLinks: filters.excludedLinks,
      excludedCountries: unknownToEmpty(filters.excludedCountries),
      excludedReferrers: unknownToEmpty(filters.excludedReferrers),
    });

    const titles = new Map(getLinks().map((l) => [l.url, l.title]));
    const linkLabel = (url) => titles.get(url) || prettyUrl(url);

    reply.header('Cache-Control', 'no-store');
    return reply.view('analytics', {
      page: 'analytics',
      stats,
      insights: buildInsights(stats, { countryName, linkLabel, focus }),
      ranges: RANGES,
      rangeKey,
      focus,
      filters,
      hasExclusions: Object.values(filters).some((list) => list.length > 0),
      worldMap: loadWorldMap(),
      countryName,
      linkLabel,
      prettyUrl,
      intensity,
      href: (changes) => withParams(q, changes),
      addFilter: (key, value) => addFilter(q, key, value),
      removeFilter: (key, value) => removeFilter(q, key, value),
    });
  });
}

export default analyticsRoutes;
