import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

function readSecret(name) {
  const file = process.env[`${name}_FILE`];
  if (file) {
    try {
      return fs.readFileSync(file, 'utf8').trim();
    } catch (err) {
      throw new Error(`Could not read ${name}_FILE (${file}): ${err.message}`);
    }
  }
  return process.env[name] || '';
}

const bool = (value, fallback = false) =>
  value === undefined || value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT) || 3000,
  adminPort: Number(process.env.ADMIN_PORT) || 3001,
  dataDir: path.resolve(ROOT_DIR, process.env.DATA_DIR || 'db'),
  themesDir: path.resolve(ROOT_DIR, process.env.THEMES_DIR || 'themes'),
  publicDir: path.join(ROOT_DIR, 'public'),
  viewsDir: path.join(ROOT_DIR, 'views'),
  trustProxy: bool(process.env.TRUST_PROXY, true),
  logLevel: process.env.LOG_LEVEL || 'info',
  publicUrl: process.env.PUBLIC_URL || '',
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: readSecret('ADMIN_PASSWORD'),
    authDisabled: bool(process.env.ADMIN_AUTH_DISABLED),
  },
};

export default config;
