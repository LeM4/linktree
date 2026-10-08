import { Database } from 'bun:sqlite';
import fs from 'fs';
import path from 'path';
import config from './config.js';

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, 'database.sqlite'), { create: true });
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

const DEFAULT_SETTINGS = {
  container_color: '#f0f0f0',
  username: 'My Linktree',
  profile_pic_url: '',
  bio: 'Welcome to my page!',
  page_title: 'My Linktree',
  active_theme: null,
};

function ensureColumn(table, column, definition) {
  const columns = db.query(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!columns.includes(column)) db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/** Creates/migrates the schema. Returns true when this is a fresh database. */
function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      url TEXT,
      blocked_countries TEXT,
      enabled BOOLEAN,
      is_18_plus BOOLEAN DEFAULT 0,
      order_index INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      container_color TEXT,
      username TEXT,
      profile_pic_url TEXT,
      bio TEXT,
      page_title TEXT,
      active_theme TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS icon_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT,
      svg_code TEXT,
      order_index INTEGER
    )
  `);
  ensureColumn('links', 'is_18_plus', 'BOOLEAN DEFAULT 0');
  ensureColumn('settings', 'active_theme', 'TEXT');

  if (getSettings()) return false;
  updateSettings(DEFAULT_SETTINGS);
  return true;
}

function getSettings() {
  return db.query('SELECT * FROM settings WHERE id = 1').get();
}

/** Merges the given fields into the settings row. */
function updateSettings(changes) {
  const s = { ...DEFAULT_SETTINGS, ...getSettings(), ...changes };
  db.run(
    `INSERT OR REPLACE INTO settings (id, container_color, username, profile_pic_url, bio, page_title, active_theme)
     VALUES (1, ?, ?, ?, ?, ?, ?)`,
    [s.container_color, s.username, s.profile_pic_url, s.bio, s.page_title, s.active_theme]
  );
}

function setActiveTheme(themeName) {
  updateSettings({ active_theme: themeName || null });
}

function parseBlocked(raw) {
  try {
    const value = JSON.parse(raw || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function withBlocked(link) {
  return link && { ...link, blocked: parseBlocked(link.blocked_countries) };
}

function getLinks() {
  return db.query('SELECT * FROM links ORDER BY order_index, id').all().map(withBlocked);
}

function getLink(id) {
  return withBlocked(db.query('SELECT * FROM links WHERE id = ?').get(id));
}

function isVisible(link, country) {
  return Boolean(link?.enabled) && !(country && link.blocked.includes(country));
}

function getVisibleLinks(country) {
  return getLinks().filter((link) => isVisible(link, country));
}

function addLink(title, url) {
  db.run(
    `INSERT INTO links (title, url, blocked_countries, enabled, order_index, is_18_plus)
     VALUES (?, ?, '[]', 1, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM links), 0)`,
    [title, url]
  );
}

function updateLink(id, { title, url, blocked }) {
  db.run('UPDATE links SET title = ?, url = ?, blocked_countries = ? WHERE id = ?', [
    title,
    url,
    JSON.stringify(blocked),
    id,
  ]);
}

function toggleLink(id) {
  db.run('UPDATE links SET enabled = NOT enabled WHERE id = ?', [id]);
}

function toggleLink18Plus(id) {
  db.run('UPDATE links SET is_18_plus = NOT COALESCE(is_18_plus, 0) WHERE id = ?', [id]);
}

function deleteLink(id) {
  db.run('DELETE FROM links WHERE id = ?', [id]);
}

/** Swaps a row with its neighbour in the given direction ('up' | 'down'). */
const moveRow = (table) =>
  db.transaction((id, direction) => {
    const rows = db.query(`SELECT id FROM ${table} ORDER BY order_index, id`).all();
    const index = rows.findIndex((r) => r.id === Number(id));
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= rows.length) return;
    [rows[index], rows[target]] = [rows[target], rows[index]];
    const stmt = db.prepare(`UPDATE ${table} SET order_index = ? WHERE id = ?`);
    rows.forEach((row, i) => stmt.run(i + 1, row.id));
  });

const moveLink = moveRow('links');
const moveIconLink = moveRow('icon_links');

function getIconLinks() {
  return db.query('SELECT * FROM icon_links ORDER BY order_index, id').all();
}

function addIconLink(url, svgCode) {
  db.run(
    'INSERT INTO icon_links (url, svg_code, order_index) VALUES (?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM icon_links))',
    [url, svgCode]
  );
}

function deleteIconLink(id) {
  db.run('DELETE FROM icon_links WHERE id = ?', [id]);
}

function seedSampleLinks() {
  const samples = [
    ['My Website', 'https://www.example.com/', '[]', 1],
    ['My Socials', 'https://social.example.com/', '[]', 1],
    ['Hidden in the US', 'https://www.example.com/geo', '["US"]', 1],
    ['Disabled Link', 'https://www.example.com/disabled', '[]', 0],
  ];
  const stmt = db.prepare(
    `INSERT INTO links (title, url, blocked_countries, enabled, order_index, is_18_plus)
     VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM links), 0)`
  );
  db.transaction(() => samples.forEach((s) => stmt.run(...s)))();
}

export {
  db,
  initDb,
  getSettings,
  updateSettings,
  setActiveTheme,
  getLinks,
  getLink,
  isVisible,
  getVisibleLinks,
  addLink,
  updateLink,
  toggleLink,
  toggleLink18Plus,
  deleteLink,
  moveLink,
  moveIconLink,
  getIconLinks,
  addIconLink,
  deleteIconLink,
  seedSampleLinks,
};
