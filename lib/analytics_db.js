import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import config from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, 'analytics.sqlite'), { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

function initAnalyticsDb() {
  db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT)');
  db.run(`
    CREATE TABLE IF NOT EXISTS fingerprints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      fingerprint TEXT UNIQUE,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS visitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      country TEXT,
      referrer TEXT,
      timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS link_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitation_id INTEGER,
      link_url TEXT,
      timestamp DATETIME DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (visitation_id) REFERENCES visitations (id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS unknown_visitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visitation_id INTEGER,
      user_agent TEXT,
      FOREIGN KEY (visitation_id) REFERENCES visitations (id)
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_visitations_timestamp ON visitations (timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_link_clicks_visitation ON link_clicks (visitation_id)');
}

const findOrCreateUser = db.transaction((fingerprint, userId = null) => {
  const known = Number.isInteger(userId) && db.query('SELECT id FROM users WHERE id = ?').get(userId);
  if (known) {
    if (fingerprint) db.run('INSERT OR IGNORE INTO fingerprints (user_id, fingerprint) VALUES (?, ?)', [known.id, fingerprint]);
    return known;
  }

  if (fingerprint) {
    const user = db
      .query('SELECT u.id FROM users u JOIN fingerprints f ON u.id = f.user_id WHERE f.fingerprint = ?')
      .get(fingerprint);
    if (user) return user;
  }

  const { lastInsertRowid } = db.run('INSERT INTO users DEFAULT VALUES');
  const id = Number(lastInsertRowid);
  if (fingerprint) db.run('INSERT INTO fingerprints (user_id, fingerprint) VALUES (?, ?)', [id, fingerprint]);
  return { id };
});

function addVisitation(userId, country, referrer, userAgent) {
  const { lastInsertRowid } = db.run('INSERT INTO visitations (user_id, country, referrer) VALUES (?, ?, ?)', [
    userId,
    country,
    referrer,
  ]);
  const visitationId = Number(lastInsertRowid);
  if (!referrer) {
    db.run('INSERT INTO unknown_visitations (visitation_id, user_agent) VALUES (?, ?)', [
      visitationId,
      (userAgent || '').slice(0, 512),
    ]);
  }
  return visitationId;
}

function addLinkClick(visitationId, linkUrl) {
  const visit = db.query('SELECT id FROM visitations WHERE id = ?').get(visitationId);
  if (visit) db.run('INSERT INTO link_clicks (visitation_id, link_url) VALUES (?, ?)', [visit.id, linkUrl]);
}

const placeholders = (list) => list.map(() => '?').join(',');
const where = (clauses) => (clauses.length ? `WHERE ${clauses.join(' AND ')}` : '');
const and = (whereSql) => (whereSql ? `${whereSql} AND` : 'WHERE');

function buildFilters({ excludedLinks = [], excludedCountries = [], excludedReferrers = [] }) {
  const visit = { clauses: [], params: [] };
  const click = { clauses: [], params: [] };

  if (excludedCountries.length) {
    visit.clauses.push(`COALESCE(v.country, '') NOT IN (${placeholders(excludedCountries)})`);
    visit.params.push(...excludedCountries);
    click.clauses.push(
      `lc.visitation_id IN (SELECT id FROM visitations WHERE COALESCE(country, '') NOT IN (${placeholders(excludedCountries)}))`
    );
    click.params.push(...excludedCountries);
  }
  if (excludedLinks.length) {
    click.clauses.push(`lc.link_url NOT IN (${placeholders(excludedLinks)})`);
    click.params.push(...excludedLinks);
  }

  const referrers = excludedReferrers.filter((r) => r !== '');
  if (referrers.length) {
    visit.clauses.push(`COALESCE(v.referrer, '') NOT IN (${placeholders(referrers)})`);
    visit.params.push(...referrers);
    click.clauses.push(
      `lc.visitation_id IN (SELECT id FROM visitations WHERE COALESCE(referrer, '') NOT IN (${placeholders(referrers)}))`
    );
    click.params.push(...referrers);
  }
  if (excludedReferrers.includes('')) {
    visit.clauses.push("COALESCE(v.referrer, '') != ''");
    click.clauses.push("lc.visitation_id IN (SELECT id FROM visitations WHERE COALESCE(referrer, '') != '')");
  }

  return {
    visitWhere: where(visit.clauses),
    visitParams: visit.params,
    clickWhere: where(click.clauses),
    clickParams: click.params,
  };
}

const HOURS = 12;

function hourlyBuckets() {
  const stmt = db.query("SELECT strftime('%Y-%m-%d %H', 'now', 'localtime', ?) AS bucket");
  return Array.from({ length: HOURS + 1 }, (_, i) => stmt.get(`-${HOURS - i} hours`).bucket);
}

function getAnalytics(filters = {}) {
  const { visitWhere, visitParams, clickWhere, clickParams } = buildFilters(filters);
  const recent = `v.timestamp >= strftime('%Y-%m-%d %H:00:00', 'now', 'localtime', '-${HOURS} hours')`;

  const totalVisits = db.query(`SELECT COUNT(*) AS count FROM visitations v ${visitWhere}`).get(...visitParams).count;
  const uniqueVisitors = db
    .query(`SELECT COUNT(DISTINCT v.user_id) AS count FROM visitations v ${visitWhere}`)
    .get(...visitParams).count;
  const totalClicks = db.query(`SELECT COUNT(*) AS count FROM link_clicks lc ${clickWhere}`).get(...clickParams).count;
  const topCountries = db
    .query(`SELECT v.country, COUNT(*) AS count FROM visitations v ${visitWhere} GROUP BY v.country ORDER BY count DESC LIMIT 20`)
    .all(...visitParams);
  const topReferrers = db
    .query(`SELECT v.referrer, COUNT(*) AS count FROM visitations v ${visitWhere} GROUP BY v.referrer ORDER BY count DESC LIMIT 20`)
    .all(...visitParams);
  const topLinks = db
    .query(`SELECT lc.link_url, COUNT(*) AS count FROM link_clicks lc ${clickWhere} GROUP BY lc.link_url ORDER BY count DESC LIMIT 20`)
    .all(...clickParams);
  const visitationsByDate = db
    .query(`SELECT DATE(v.timestamp) AS date, COUNT(*) AS count FROM visitations v ${visitWhere} GROUP BY DATE(v.timestamp) ORDER BY date`)
    .all(...visitParams);

  const buckets = hourlyBuckets();
  const toSeries = (rows) => {
    const counts = Object.fromEntries(rows.map((r) => [r.bucket, r.count]));
    return buckets.map((b) => counts[b] || 0);
  };
  const hourlySql = (extra = '') =>
    `SELECT strftime('%Y-%m-%d %H', v.timestamp) AS bucket, COUNT(*) AS count
     FROM visitations v ${and(visitWhere)} ${recent} ${extra} GROUP BY bucket`;

  const hourly = {
    labels: buckets.map((b) => `${b.slice(-2)}:00`),
    total: toSeries(db.query(hourlySql()).all(...visitParams)),
    byCountry: topCountries.slice(0, 3).map(({ country }) => ({
      country,
      data: toSeries(db.query(hourlySql('AND v.country IS ?')).all(...visitParams, country)),
    })),
  };

  const polarChartData = [];
  const top3 = topLinks.slice(0, 3);
  for (const link of top3) {
    const rows = db
      .query(
        `SELECT v.country, COUNT(*) AS count FROM link_clicks lc
         JOIN visitations v ON lc.visitation_id = v.id
         ${and(clickWhere)} lc.link_url = ?
         GROUP BY v.country ORDER BY count DESC`
      )
      .all(...clickParams, link.link_url);
    rows.slice(0, 4).forEach((row) =>
      polarChartData.push({ label: `${link.link_url} - ${row.country || '??'}`, count: row.count, link: link.link_url })
    );
    const other = rows.slice(4).reduce((sum, row) => sum + row.count, 0);
    if (other) polarChartData.push({ label: `${link.link_url} - Other`, count: other, link: link.link_url });
  }
  if (top3.length) {
    const urls = top3.map((l) => l.link_url);
    const otherLinks = db
      .query(`SELECT COUNT(*) AS count FROM link_clicks lc ${and(clickWhere)} lc.link_url NOT IN (${placeholders(urls)})`)
      .get(...clickParams, ...urls).count;
    if (otherLinks) polarChartData.push({ label: 'Other Links', count: otherLinks, link: 'Other Links' });
  }

  return {
    totalVisits,
    uniqueVisitors,
    totalClicks,
    topCountries,
    topReferrers,
    topLinks,
    visitationsByDate,
    hourly,
    polarChartData,
  };
}

export { db, initAnalyticsDb, findOrCreateUser, addVisitation, addLinkClick, getAnalytics };
