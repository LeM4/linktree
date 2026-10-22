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
  db.run('CREATE INDEX IF NOT EXISTS idx_visitations_user ON visitations (user_id)');
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

export { db, initAnalyticsDb, findOrCreateUser, addVisitation, addLinkClick };
