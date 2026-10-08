import { db } from './db.js';

const TABLES = ['links', 'settings', 'icon_links'];

/** Exports links, settings and icon links as `{ tables: [{ name, rows }] }`. */
function exportDb() {
  return {
    exportedAt: new Date().toISOString(),
    tables: TABLES.map((name) => ({ name, rows: db.query(`SELECT * FROM ${name}`).all() })).filter(
      (t) => t.rows.length > 0
    ),
  };
}

/**
 * Replaces the content of every table present in the JSON export.
 * Unknown tables are rejected; columns are matched against the current schema,
 * missing ones become NULL and unknown ones are ignored. All-or-nothing.
 */
function importDb(jsonString) {
  const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
  if (!data || !Array.isArray(data.tables)) throw new Error('Invalid export: missing "tables" array.');

  for (const table of data.tables) {
    if (!TABLES.includes(table?.name)) throw new Error(`Invalid export: unknown table "${table?.name}".`);
    if (!Array.isArray(table.rows)) throw new Error(`Invalid export: "${table.name}.rows" must be an array.`);
  }

  db.transaction(() => {
    for (const { name, rows } of data.tables) {
      db.run(`DELETE FROM ${name}`);
      if (!rows.length) continue;

      const columns = db.query(`PRAGMA table_info(${name})`).all().map((c) => c.name);
      const stmt = db.prepare(
        `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`
      );
      for (const row of rows) {
        stmt.run(...columns.map((col) => (row && Object.hasOwn(row, col) ? row[col] : null)));
      }
    }
  })();
}

export { exportDb, importDb };
