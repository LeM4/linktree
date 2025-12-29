import { db } from './db.js';

/**
 * Exports all data from the database into a JSON object.
 * This function reads all rows from the 'links', 'settings', and 'icon_links' tables
 * and formats them into a structured JSON object.
 * @returns {object} A JSON object representing the database content.
 */
function exportDb() {
  const tables = {};

  const links = db.query("SELECT * FROM links").all();
  if (links.length > 0) {
    tables.links = links;
  }

  const settings = db.query("SELECT * FROM settings").all();
  if (settings.length > 0) {
    tables.settings = settings;
  }

  const iconLinks = db.query("SELECT * FROM icon_links").all();
  if (iconLinks.length > 0) {
    tables.icon_links = iconLinks;
  }
  
  const formatted = {
      tables: Object.entries(tables).map(([name, rows]) => ({ name, rows }))
  };

  return formatted;
}

/**
 * Imports data from a JSON object into the database.
 * This function is designed to be resilient to schema changes. It will only
 * import columns that exist in the current database schema and will insert NULL
 * for any columns that are missing in the imported data but exist in the table.
 * @param {string} jsonString - The JSON string representing the database content.
 */
function importDb(jsonString) {
    const data = JSON.parse(jsonString);

    // Use a transaction to ensure that the import is all or nothing.
    db.transaction(() => {
        if (!data.tables) return;
        
        // Clear existing data from only the tables that are present in the import file.
        for (const table of data.tables) {
            db.run(`DELETE FROM ${table.name}`);
        }

        // Loop through each table in the imported data.
        for (const table of data.tables) {
            const tableName = table.name;
            const rows = table.rows;

            if (!rows || rows.length === 0) continue;

            // Get the schema of the current database table.
            const tableInfo = db.query(`PRAGMA table_info(${tableName})`).all();
            const dbColumns = tableInfo.map(col => col.name);

            const placeholders = dbColumns.map(() => '?').join(', ');
            
            try {
                // Prepare an INSERT statement that includes all columns in the current table schema.
                const stmt = db.prepare(`INSERT INTO ${tableName} (${dbColumns.join(', ')}) VALUES (${placeholders})`);

                // Loop through each row in the imported data for the current table.
                for (const row of rows) {
                    // Create an array of values that matches the order of the columns in the database.
                    // If a column is missing from the imported row, use NULL.
                    // Extra columns in the imported row are ignored.
                    const values = dbColumns.map(col => row.hasOwnProperty(col) ? row[col] : null);
                    stmt.run(...values);
                }
            } catch(e) {
                // If there's an error (e.g., table doesn't exist), log it and continue to the next table.
                console.error(`Skipping table ${tableName} due to error: ${e.message}`);
            }
        }
    })();
}

export { exportDb, importDb };
