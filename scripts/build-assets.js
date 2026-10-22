// Copies browser libraries and fonts from node_modules into public/ so the app
// serves everything itself (no third-party CDNs, no Google Fonts requests).
import fs from 'fs';
import path from 'path';
import { ROOT_DIR } from '../lib/config.js';

const modules = path.join(ROOT_DIR, 'node_modules');
const publicDir = path.join(ROOT_DIR, 'public');

const files = {
  'vendor/htmx.min.js': 'htmx.org/dist/htmx.min.js',
  'vendor/alpine.min.js': 'alpinejs/dist/cdn.min.js',
  'vendor/chart.umd.min.js': 'chart.js/dist/chart.umd.min.js',
  'vendor/fp.umd.min.js': '@fingerprintjs/fingerprintjs/dist/fp.umd.min.js',
  'fonts/geist-latin-wght-normal.woff2': '@fontsource-variable/geist/files/geist-latin-wght-normal.woff2',
  'fonts/geist-latin-ext-wght-normal.woff2': '@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2',
};

let failed = false;
for (const [target, source] of Object.entries(files)) {
  const from = path.join(modules, source);
  const to = path.join(publicDir, target);
  if (!fs.existsSync(from)) {
    console.error(`missing ${source} – did you run "bun install"?`);
    failed = true;
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`copied ${source} -> public/${target}`);
}

if (failed) process.exit(1);
