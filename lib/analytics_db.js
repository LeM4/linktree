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

function addVisitation(userId, country, referrer) {
    db.run(
        "INSERT INTO visitations (user_id, country, referrer) VALUES (?, ?, ?)",
        [userId, country, referrer]
    );
}

function addLinkClick(visitationId, linkUrl) {
    db.run(
        "INSERT INTO link_clicks (visitation_id, link_url) VALUES (?, ?)",
        [visitationId, linkUrl]
    );
}

function getAnalytics() {
    const totalVisits = db.query("SELECT COUNT(*) as count FROM visitations").get().count;
    const uniqueVisitors = db.query("SELECT COUNT(*) as count FROM users").get().count;
    const topCountries = db.query("SELECT country, COUNT(*) as count FROM visitations GROUP BY country ORDER BY count DESC LIMIT 20").all();
    const topReferrers = db.query("SELECT referrer, COUNT(*) as count FROM visitations GROUP BY referrer ORDER BY count DESC LIMIT 20").all();
    const topLinks = db.query("SELECT link_url, COUNT(*) as count FROM link_clicks GROUP BY link_url ORDER BY count DESC LIMIT 20").all();
    const visitationsByDate = db.query("SELECT DATE(timestamp) as date, COUNT(*) as count FROM visitations GROUP BY DATE(timestamp) ORDER BY date").all();
    const visitationsLast12Hours = db.query("SELECT strftime('%H', timestamp) as hour, COUNT(*) as count FROM visitations WHERE timestamp >= datetime('now', '-12 hours', 'localtime') GROUP BY hour").all();

    const top3Countries = topCountries.slice(0, 3);
    const topCountriesByHour = top3Countries.map(country => {
        const data = db.query(`
            SELECT strftime('%H', timestamp) as hour, COUNT(*) as count 
            FROM visitations 
            WHERE country = ? AND timestamp >= datetime('now', '-12 hours', 'localtime') 
            GROUP BY hour
        `).all(country.country);
        return { country: country.country, data: data };
    });

    // Data for Polar Chart
    const polarChartData = [];
    const top3Links = topLinks.slice(0, 3);
    const top3LinkUrls = top3Links.map(l => l.link_url);

    top3Links.forEach(link => {
        const linkCountryClicks = db.query(`
            SELECT v.country, COUNT(*) as count 
            FROM link_clicks lc
            JOIN visitations v ON lc.visitation_id = v.id
            WHERE lc.link_url = ?
            GROUP BY v.country
            ORDER BY count DESC
        `).all(link.link_url);

        const top3CountriesForLink = linkCountryClicks.slice(0, 3);
        const otherCountriesCount = linkCountryClicks.slice(3).reduce((sum, row) => sum + row.count, 0);

        top3CountriesForLink.forEach(country => {
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

    const otherLinksCount = db.query(`
        SELECT COUNT(*) as count 
        FROM link_clicks 
        WHERE link_url NOT IN (${top3LinkUrls.map(() => '?').join(',')})
    `).get(...top3LinkUrls).count;

    if (otherLinksCount > 0) {
        polarChartData.push({
            label: 'Other Links',
            count: otherLinksCount,
            link: 'Other Links'
        });
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
