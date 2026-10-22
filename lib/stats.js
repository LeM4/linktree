import { db } from './analytics_db.js';

export const RANGES = {
  '24h': { label: '24h', title: 'last 24 hours', hours: 24, bucket: 'hour' },
  '7d': { label: '7d', title: 'last 7 days', hours: 24 * 7, bucket: 'day' },
  '30d': { label: '30d', title: 'last 30 days', hours: 24 * 30, bucket: 'day' },
  '90d': { label: '90d', title: 'last 90 days', hours: 24 * 90, bucket: 'day' },
  all: { label: 'All', title: 'all time', hours: null, bucket: 'day' },
};
export const DEFAULT_RANGE = '30d';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SQLITE_DOW = [1, 2, 3, 4, 5, 6, 0]; // strftime('%w') is 0 = Sunday

const sqlTime = (time, modifier) => db.query('SELECT datetime(?, ?) AS t').get(time, modifier).t;
const ph = (list) => list.map(() => '?').join(',');

/** Current and previous period as [start, end) local-time strings. */
function periods(rangeKey) {
  const range = RANGES[rangeKey] || RANGES[DEFAULT_RANGE];
  const now = db.query("SELECT datetime('now', 'localtime') AS t").get().t;
  const end = sqlTime(now, '+1 minute');
  if (!range.hours) {
    const first = db.query('SELECT MIN(timestamp) AS t FROM visitations').get().t || now;
    return { range, current: { start: first, end }, previous: null, now };
  }
  const start = sqlTime(now, `-${range.hours} hours`);
  return {
    range,
    current: { start, end },
    previous: { start: sqlTime(start, `-${range.hours} hours`), end: start },
    now,
  };
}

/**
 * SQL fragments for one period + filter set. Visits are aliased `v`, clicks `lc`;
 * clicks are attributed to the visit (and its country/referrer) they came from.
 */
function scope(period, f) {
  const clauses = ['v.timestamp >= ?', 'v.timestamp < ?'];
  const params = [period.start, period.end];
  if (f.country != null) {
    clauses.push("COALESCE(v.country, '') = ?");
    params.push(f.country);
  }
  if (f.excludedCountries.length) {
    clauses.push(`COALESCE(v.country, '') NOT IN (${ph(f.excludedCountries)})`);
    params.push(...f.excludedCountries);
  }
  if (f.excludedReferrers.length) {
    clauses.push(`COALESCE(v.referrer, '') NOT IN (${ph(f.excludedReferrers)})`);
    params.push(...f.excludedReferrers);
  }
  const link = f.excludedLinks.length
    ? { sql: `AND lc.link_url NOT IN (${ph(f.excludedLinks)})`, params: f.excludedLinks }
    : { sql: '', params: [] };

  return {
    where: `WHERE ${clauses.join(' AND ')}`,
    params,
    visits: (select, rest = '') => db.query(`SELECT ${select} FROM visitations v WHERE ${clauses.join(' AND ')} ${rest}`),
    clicks: (select, rest = '') =>
      db.query(
        `SELECT ${select} FROM link_clicks lc JOIN visitations v ON v.id = lc.visitation_id
         WHERE ${clauses.join(' AND ')} ${link.sql} ${rest}`
      ),
    clickParams: [...params, ...link.params],
    link,
    end: period.end,
  };
}

function kpis(s) {
  const { visits, visitors } = s.visits('COUNT(*) AS visits, COUNT(DISTINCT v.user_id) AS visitors').get(...s.params);
  const { clicks, engaged } = s
    .clicks('COUNT(*) AS clicks, COUNT(DISTINCT lc.visitation_id) AS engaged')
    .get(...s.clickParams);
  // Returning = visited on at least two different days (up to the end of the period).
  const { comeback } = db
    .query(
      `SELECT COUNT(*) AS comeback FROM (SELECT DISTINCT v.user_id FROM visitations v ${s.where}) u
       WHERE (SELECT COUNT(DISTINCT DATE(x.timestamp)) FROM visitations x WHERE x.user_id = u.user_id AND x.timestamp < ?) > 1`
    )
    .get(...s.params, s.end);
  return {
    visits,
    visitors,
    clicks,
    ctr: visits ? engaged / visits : 0,
    returning: visitors ? comeback / visitors : 0,
  };
}

const delta = (current, previous) => (previous ? (current - previous) / previous : null);

function trend(s, p) {
  const hourly = p.range.bucket === 'hour';
  const fmt = hourly ? '%Y-%m-%d %H' : '%Y-%m-%d';
  let keys;
  if (hourly) {
    const stmt = db.query("SELECT strftime('%Y-%m-%d %H', ?, ?) AS k");
    keys = Array.from({ length: 24 }, (_, i) => stmt.get(p.now, `-${23 - i} hours`).k);
  } else {
    const day = (t) => t.slice(0, 10);
    const startMs = Date.parse(`${day(p.current.start)}T00:00:00Z`);
    const endMs = Date.parse(`${day(p.now)}T00:00:00Z`);
    keys = [];
    for (let t = startMs; t <= endMs; t += 86_400_000) keys.push(new Date(t).toISOString().slice(0, 10));
  }

  const toSeries = (rows) => {
    const map = new Map(rows.map((r) => [r.k, r.n]));
    return keys.map((k) => map.get(k) || 0);
  };
  const visits = s.visits(`strftime('${fmt}', v.timestamp) AS k, COUNT(*) AS n`, 'GROUP BY k').all(...s.params);
  const clicks = s.clicks(`strftime('${fmt}', v.timestamp) AS k, COUNT(*) AS n`, 'GROUP BY k').all(...s.clickParams);
  const label = (k) =>
    hourly
      ? `${k.slice(-2)}:00`
      : new Date(`${k}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return { labels: keys.map(label), visits: toSeries(visits), clicks: toSeries(clicks) };
}

function countries(s) {
  const visits = s
    .visits("COALESCE(v.country, '') AS code, COUNT(*) AS visits, COUNT(DISTINCT v.user_id) AS visitors", 'GROUP BY code')
    .all(...s.params);
  const clicks = new Map(
    s.clicks("COALESCE(v.country, '') AS code, COUNT(*) AS n", 'GROUP BY code').all(...s.clickParams).map((r) => [r.code, r.n])
  );
  const total = visits.reduce((sum, r) => sum + r.visits, 0);
  return visits
    .map((r) => ({ ...r, clicks: clicks.get(r.code) || 0, share: total ? r.visits / total : 0 }))
    .sort((a, b) => b.visits - a.visits);
}

function links(s) {
  const rows = s
    .clicks(
      "lc.link_url AS url, COUNT(*) AS clicks, COUNT(DISTINCT v.user_id) AS people, COUNT(DISTINCT COALESCE(v.country, '')) AS countries",
      'GROUP BY url ORDER BY clicks DESC'
    )
    .all(...s.clickParams);
  const total = rows.reduce((sum, r) => sum + r.clicks, 0);
  return rows.map((r) => ({ ...r, share: total ? r.clicks / total : 0 }));
}

function referrers(s) {
  return db
    .query(
      `SELECT COALESCE(v.referrer, '') AS referrer, COUNT(DISTINCT v.id) AS visits, COUNT(DISTINCT lc.visitation_id) AS engaged
       FROM visitations v LEFT JOIN link_clicks lc ON lc.visitation_id = v.id ${s.link.sql}
       ${s.where} GROUP BY referrer ORDER BY visits DESC LIMIT 12`
    )
    .all(...s.link.params, ...s.params)
    .map((r) => ({ ...r, ctr: r.visits ? r.engaged / r.visits : 0 }));
}

function heatmap(rows) {
  const grid = SQLITE_DOW.map(() => Array(24).fill(0));
  for (const { dow, hour, n } of rows) grid[SQLITE_DOW.indexOf(dow)][hour] += n;
  let peak = { n: 0 };
  grid.forEach((cells, d) => cells.forEach((n, h) => n > peak.n && (peak = { day: WEEKDAYS[d], hour: h, n })));
  return {
    rows: grid.map((cells, d) => ({ label: WEEKDAYS[d], cells })),
    max: peak.n,
    total: rows.reduce((sum, r) => sum + r.n, 0),
    peak: peak.n ? peak : null,
  };
}

function heatmaps(s) {
  const time = (col) =>
    `CAST(strftime('%w', ${col}) AS INTEGER) AS dow, CAST(strftime('%H', ${col}) AS INTEGER) AS hour, COUNT(*) AS n`;
  return {
    clicks: heatmap(s.clicks(time('lc.timestamp'), 'GROUP BY dow, hour').all(...s.clickParams)),
    visits: heatmap(s.visits(time('v.timestamp'), 'GROUP BY dow, hour').all(...s.params)),
  };
}

/** Which countries click which links: top countries x top links with row shares and lift. */
function matrix(s, { maxCountries = 8, maxLinks = 6 } = {}) {
  const rows = s
    .clicks("COALESCE(v.country, '') AS code, lc.link_url AS url, COUNT(*) AS n", 'GROUP BY code, url')
    .all(...s.clickParams);
  const total = rows.reduce((sum, r) => sum + r.n, 0);
  if (!total) return { links: [], rows: [], total: 0 };

  const sum = (key) =>
    [...rows.reduce((m, r) => m.set(r[key], (m.get(r[key]) || 0) + r.n), new Map())].sort((a, b) => b[1] - a[1]);
  const linkTotals = sum('url');
  const countryTotals = sum('code');
  const topLinks = linkTotals.slice(0, maxLinks).map(([url, n]) => ({ url, total: n, share: n / total }));
  const cell = new Map(rows.map((r) => [`${r.code}\u0000${r.url}`, r.n]));

  return {
    total,
    links: topLinks,
    rows: countryTotals.slice(0, maxCountries).map(([code, rowTotal]) => {
      const cells = topLinks.map((l) => {
        const n = cell.get(`${code}\u0000${l.url}`) || 0;
        const share = n / rowTotal;
        return { n, share, lift: l.share ? share / l.share : 0 };
      });
      const best = cells.reduce((bi, c, i) => (c.n > cells[bi].n ? i : bi), 0);
      return { code, total: rowTotal, cells, best: cells[best].n ? best : -1 };
    }),
  };
}

export function normalizeFilters(input = {}) {
  return {
    country: input.country ?? null,
    excludedLinks: input.excludedLinks || [],
    excludedCountries: input.excludedCountries || [],
    excludedReferrers: input.excludedReferrers || [],
  };
}

/**
 * Everything the analytics page needs. The world map, country list and country x link
 * matrix ignore the focused country so the focus can be shown in context.
 */
export function getStats(rangeKey = DEFAULT_RANGE, input = {}) {
  const f = normalizeFilters(input);
  const p = periods(rangeKey);
  const current = scope(p.current, f);
  const world = scope(p.current, { ...f, country: null });

  const now = kpis(current);
  const before = p.previous ? kpis(scope(p.previous, f)) : null;
  const deltas = before
    ? Object.fromEntries(Object.keys(now).map((k) => [k, k === 'ctr' || k === 'returning' ? now[k] - before[k] : delta(now[k], before[k])]))
    : {};

  return {
    range: p.range,
    since: p.current.start,
    kpis: now,
    previous: before,
    deltas,
    trend: trend(current, p),
    countries: countries(world),
    links: links(current),
    referrers: referrers(current),
    heatmaps: heatmaps(current),
    matrix: matrix(world),
  };
}
