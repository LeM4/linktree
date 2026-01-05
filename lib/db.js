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
}

function getSettings() {
    return db.query("SELECT * FROM settings WHERE id = 1").get();
}

function updateSettings(containerColor, username, profilePicUrl, bio, pageTitle, activeTheme) {
    db.run(
        "INSERT OR REPLACE INTO settings (id, container_color, username, profile_pic_url, bio, page_title, active_theme) VALUES (1, ?, ?, ?, ?, ?, ?)",
        [containerColor, username, profilePicUrl, bio, pageTitle, activeTheme]
    );
}

function getIconLinks() {
    return db.query("SELECT * FROM icon_links ORDER BY order_index").all();
}

function addIconLink(url, svg_code) {
    db.run("INSERT INTO icon_links (url, svg_code, order_index) VALUES (?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM icon_links))", [url, svg_code]);
}

function deleteIconLink(id) {
    db.run("DELETE FROM icon_links WHERE id = ?", [id]);
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
    db.run("INSERT INTO links (title, url, enabled, order_index, is_18_plus) VALUES (?, ?, ?, (SELECT COALESCE(MAX(order_index), 0) + 1 FROM links), 0)", [title, url, true]);
}

function toggleLink(id) {
    db.run("UPDATE links SET enabled = NOT enabled WHERE id = ?", [id]);
}

function toggleLink18Plus(id) {
    db.run("UPDATE links SET is_18_plus = NOT is_18_plus WHERE id = ?", [id]);
}

function updateLinkCountries(id, countries) {
    db.run("UPDATE links SET blocked_countries = ? WHERE id = ?", [countries, id]);
}

function deleteLink(id) {
    db.run("DELETE FROM links WHERE id = ?", [id]);
}

function setActiveTheme(themeName) {
    const settings = getSettings();
    updateSettings(settings.container_color, settings.username, settings.profile_pic_url, settings.bio, settings.page_title, themeName);
}

function discoverThemes(themesPath) {
    const fs = require('fs');
    const path = require('path');

    if (!fs.existsSync(themesPath)) {
        fs.mkdirSync(themesPath, { recursive: true });
    }

    return fs.readdirSync(themesPath, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
}

export { 
    initDb,
    getSettings,
    updateSettings,
    setActiveTheme,
    discoverThemes,
    getLinks,
    getVisibleLinks,
    addIconLink,
    getIconLinks,
    deleteIconLink,
    addLink,
    toggleLink,
    toggleLink18Plus,
    updateLinkCountries,
    deleteLink,
    db
};
