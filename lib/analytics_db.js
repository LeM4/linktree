import { Database } from "bun:sqlite";

const db = new Database("db/analytics.sqlite", { create: true });

function initAnalyticsDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT
    )
  `);

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
}

function findOrCreateUser(fingerprint, userId = null) {
    if (userId) {
        const user = db.query("SELECT * FROM users WHERE id = ?").get(userId);
        if (user) {
            const existingFingerprint = db.query("SELECT * FROM fingerprints WHERE fingerprint = ?").get(fingerprint);
            if (!existingFingerprint) {
                db.run("INSERT INTO fingerprints (user_id, fingerprint) VALUES (?, ?)", [user.id, fingerprint]);
            }
            return user;
        }
    }
    
    let user = db.query("SELECT u.* FROM users u JOIN fingerprints f ON u.id = f.user_id WHERE f.fingerprint = ?").get(fingerprint);
    if (!user) {
        db.run("INSERT INTO users DEFAULT VALUES");
        const newUserId = db.query("SELECT last_insert_rowid() as id").get().id;
        db.run("INSERT INTO fingerprints (user_id, fingerprint) VALUES (?, ?)", [newUserId, fingerprint]);
        user = { id: newUserId };
    }
    return user;
}

function addVisitation(userId, country, referrer, userAgent) {
    db.run(
        "INSERT INTO visitations (user_id, country, referrer) VALUES (?, ?, ?)",
        [userId, country, referrer]
    );

    const visitationId = db.query("SELECT last_insert_rowid() as id").get().id;

    if (!referrer || referrer === '') {
        db.run(
            "INSERT INTO unknown_visitations (visitation_id, user_agent) VALUES (?, ?)",
            [visitationId, userAgent]
        );
    }

    return visitationId;
}

function addLinkClick(visitationId, linkUrl) {
    db.run(
        "INSERT INTO link_clicks (visitation_id, link_url) VALUES (?, ?)",
        [visitationId, linkUrl]
    );
}

function getAnalytics(filters = {}) {
    const { excludedLinks = [], excludedCountries = [], excludedReferrers = [] } = filters;

    // Filters for queries on the 'visitations' table (aliased as 'v')
    const visitWhereClauses = [];
    const visitParams = [];
    if (excludedCountries.length > 0) {
        visitWhereClauses.push(`v.country NOT IN (${excludedCountries.map(() => '?').join(',')})`);
        visitParams.push(...excludedCountries);
    }
    
    // Filters for queries involving 'link_clicks' (aliased as 'lc') and 'visitations'
    const linkClickWhereClauses = [];
    const linkClickParams = [];
    if (excludedLinks.length > 0) {
        linkClickWhereClauses.push(`lc.link_url NOT IN (${excludedLinks.map(() => '?').join(',')})`);
        linkClickParams.push(...excludedLinks);
    }
    if (excludedCountries.length > 0) {
        // We need to use a subquery here to filter visitations before joining
        linkClickWhereClauses.push(`lc.visitation_id IN (SELECT id FROM visitations WHERE country NOT IN (${excludedCountries.map(() => '?').join(',')}))`);
        linkClickParams.push(...excludedCountries);
    }
    if (excludedReferrers.length > 0) {
        const nonNullReferrers = excludedReferrers.filter(r => r !== '');
        const hasNullReferrer = excludedReferrers.includes('');
        
        if (nonNullReferrers.length > 0) {
            visitWhereClauses.push(`v.referrer NOT IN (${nonNullReferrers.map(() => '?').join(',')})`);
            visitParams.push(...nonNullReferrers);
            linkClickWhereClauses.push(`lc.visitation_id IN (SELECT id FROM visitations WHERE referrer NOT IN (${nonNullReferrers.map(() => '?').join(',')}))`);
            linkClickParams.push(...nonNullReferrers);
        }
        if (hasNullReferrer) {
            visitWhereClauses.push("v.referrer IS NOT NULL AND v.referrer != ''");
            linkClickWhereClauses.push("lc.visitation_id IN (SELECT id FROM visitations WHERE referrer IS NOT NULL AND referrer != '')");
        }
    }
    const visitWhere = visitWhereClauses.length > 0 ? `WHERE ${visitWhereClauses.join(' AND ')}` : '';
    const linkClickWhere = linkClickWhereClauses.length > 0 ? `WHERE ${linkClickWhereClauses.join(' AND ')}` : '';

    const totalVisits = db.query(`SELECT COUNT(*) as count FROM visitations v ${visitWhere}`).get(...visitParams).count;
    const uniqueVisitors = db.query(`SELECT COUNT(DISTINCT v.user_id) as count FROM visitations v ${visitWhere}`).get(...visitParams).count;
    const topCountries = db.query(`SELECT v.country, COUNT(*) as count FROM visitations v ${visitWhere} GROUP BY v.country ORDER BY count DESC LIMIT 20`).all(...visitParams);
    const topReferrers = db.query(`SELECT v.referrer, COUNT(*) as count FROM visitations v ${visitWhere} GROUP BY v.referrer ORDER BY count DESC LIMIT 20`).all(...visitParams);
    const topLinks = db.query(`SELECT lc.link_url, COUNT(*) as count FROM link_clicks lc JOIN visitations v ON lc.visitation_id = v.id ${linkClickWhere} GROUP BY lc.link_url ORDER BY count DESC LIMIT 20`).all(...linkClickParams);
    const visitationsByDate = db.query(`SELECT DATE(v.timestamp) as date, COUNT(*) as count FROM visitations v ${visitWhere} GROUP BY DATE(v.timestamp) ORDER BY date`).all(...visitParams);
    const visitationsLast12Hours = db.query(`SELECT strftime('%H', v.timestamp) as hour, COUNT(*) as count FROM visitations v ${visitWhere.length > 0 ? `${visitWhere} AND` : 'WHERE'} v.timestamp >= datetime('now', '-12 hours', 'localtime') GROUP BY hour`).all(...visitParams);
    
    // ... (the rest of the function needs to be updated to use the filtered data)
    const top3Countries = topCountries.slice(0, 3);
    const topCountriesByHour = top3Countries.map(country => {
        const query = `
            SELECT strftime('%H', v.timestamp) as hour, COUNT(*) as count 
            FROM visitations v 
            ${visitWhere} ${visitWhere.length > 0 ? 'AND' : 'WHERE'} country = ? AND v.timestamp >= datetime('now', '-12 hours', 'localtime') 
            GROUP BY hour
        `;
        const data = db.query(query).all(...visitParams, country.country);
        return { country: country.country, data: data };
    });

    // Data for Polar Chart
    const polarChartData = [];
    const top3Links = topLinks.slice(0, 3);
    const top3LinkUrls = top3Links.map(l => l.link_url);

    top3Links.forEach(link => {
        const query = `
            SELECT v.country, COUNT(*) as count 
            FROM link_clicks lc
            JOIN visitations v ON lc.visitation_id = v.id
            ${linkClickWhere} ${linkClickWhere.length > 0 ? 'AND' : 'WHERE'} lc.link_url = ?
            GROUP BY v.country
            ORDER BY count DESC
        `;
        const linkCountryClicks = db.query(query).all(...linkClickParams, link.link_url);

        const top4CountriesForLink = linkCountryClicks.slice(0, 4);
        const otherCountriesCount = linkCountryClicks.slice(4).reduce((sum, row) => sum + row.count, 0);

        top4CountriesForLink.forEach(country => {
            polarChartData.push({
                label: `${link.link_url} - ${country.country}`,
                count: country.count,
                link: link.link_url
            });
        });

        if (otherCountriesCount > 0) {
            polarChartData.push({
                label: `${link.link_url} - Other`,
                count: otherCountriesCount,
                link: link.link_url
            });
        }
    });

    if (top3LinkUrls.length > 0) {
        const otherLinksQuery = `
            SELECT COUNT(*) as count 
            FROM link_clicks lc
            ${linkClickWhere} ${linkClickWhere.length > 0 ? 'AND' : 'WHERE'} lc.link_url NOT IN (${top3LinkUrls.map(() => '?').join(',')})
        `;
        const otherLinksCount = db.query(otherLinksQuery).get(...linkClickParams, ...top3LinkUrls).count;

        if (otherLinksCount > 0) {
            polarChartData.push({
                label: 'Other Links',
                count: otherLinksCount,
                link: 'Other Links'
            });
        }
    }

    return {
        totalVisits,
        uniqueVisitors,
        topCountries,
        topReferrers,
        topLinks,
        visitationsByDate,
        visitationsLast12Hours,
        topCountriesByHour,
        polarChartData
    };
}


export { initAnalyticsDb, findOrCreateUser, addVisitation, addLinkClick, getAnalytics };
