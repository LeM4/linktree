import { Database } from "bun:sqlite";

const db = new Database("db/database.sqlite", { create: true });

function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      url TEXT,
      blocked_countries TEXT,
      enabled BOOLEAN,
      order_index INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      container_color TEXT
    )
  `);
}

function getSettings() {
    return db.query("SELECT * FROM settings WHERE id = 1").get();
}

function updateSettings(containerColor) {
    db.run(
        "INSERT OR REPLACE INTO settings (id, container_color) VALUES (1, ?)",
        [containerColor]
    );
}

function getLinks() {
  return db.query("SELECT * FROM links ORDER BY order_index").all();
}

function getVisibleLinks(country) {
  const allLinks = getLinks();
  return allLinks.filter(link => {
    if (!link.enabled) {
      return false;
    }
    if (link.blocked_countries) {
      const blocked = JSON.parse(link.blocked_countries);
      if (blocked.includes(country)) {
        return false;
      }
    }
    return true;
  });
}

function addLink(title, url) {
    db.run("INSERT INTO links (title, url, enabled, order_index) VALUES (?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM links))", [title, url, true]);
}

function toggleLink(id) {
    db.run("UPDATE links SET enabled = NOT enabled WHERE id = ?", [id]);
}

function updateLinkCountries(id, countries) {
    db.run("UPDATE links SET blocked_countries = ? WHERE id = ?", [countries, id]);
}

function deleteLink(id) {
    db.run("DELETE FROM links WHERE id = ?", [id]);
}

export { 
    initDb,
    getSettings,
    updateSettings,
    getLinks,
    getVisibleLinks,
    addLink,
    toggleLink,
    updateLinkCountries,
    deleteLink,
    db 
};
