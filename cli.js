#!/usr/bin/env bun
// Small maintenance CLI: `bun cli.js <command>` (or `docker exec <container> bun cli.js <command>`).
import fs from 'fs';
import { initDatabases } from './lib/setup.js';
import { seedSampleLinks } from './lib/db.js';
import { exportDb, importDb } from './lib/import_export.js';

const HELP = `Usage: bun cli.js <command> [args]

Commands:
  init               Create or migrate the databases (no sample data)
  seed               Add a few sample links
  export [file]      Export links, settings and icons as JSON (stdout if no file)
  import <file>      Replace links, settings and icons from a JSON export
  help               Show this help`;

const [command = 'help', arg] = process.argv.slice(2);

function fail(message) {
  console.error(message);
  process.exit(1);
}

switch (command) {
  case 'init': {
    const { fresh } = initDatabases({ seed: false });
    console.error(fresh ? 'Databases created.' : 'Databases are up to date.');
    break;
  }
  case 'seed':
    initDatabases({ seed: false });
    seedSampleLinks();
    console.error('Sample links added.');
    break;
  case 'export': {
    initDatabases({ seed: false });
    const json = JSON.stringify(exportDb(), null, 2);
    if (arg) {
      fs.writeFileSync(arg, json);
      console.error(`Exported to ${arg}`);
    } else {
      process.stdout.write(`${json}\n`);
    }
    break;
  }
  case 'import':
    if (!arg) fail('Usage: bun cli.js import <file>');
    initDatabases({ seed: false });
    try {
      importDb(fs.readFileSync(arg, 'utf8'));
    } catch (err) {
      fail(`Import failed: ${err.message}`);
    }
    console.error(`Imported ${arg}`);
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log(HELP);
    break;
  default:
    fail(`Unknown command "${command}".\n\n${HELP}`);
}
