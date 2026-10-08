import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'linktree-test-'));
process.env.DATA_DIR = dataDir;
process.env.ADMIN_USERNAME = 'admin';
process.env.ADMIN_PASSWORD = 'test-password';

const auth = { authorization: `Basic ${Buffer.from('admin:test-password').toString('base64')}` };
const form = (data) => ({
  payload: new URLSearchParams(data).toString(),
  headers: { ...auth, 'content-type': 'application/x-www-form-urlencoded' },
});

let publicApp;
let adminApp;
let db;

beforeAll(async () => {
  const { initDatabases } = await import('../lib/setup.js');
  initDatabases();
  db = await import('../lib/db.js');
  publicApp = (await import('../server.js')).buildPublicApp({ logger: false });
  adminApp = (await import('../admin-server.js')).buildAdminApp({ logger: false });
  await Promise.all([publicApp.ready(), adminApp.ready()]);
});

afterAll(async () => {
  await Promise.all([publicApp?.close(), adminApp?.close()]);
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('public site', () => {
  test('renders links and hides geo-blocked ones', async () => {
    const res = await publicApp.inject({ url: '/', headers: { 'cf-ipcountry': 'US' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('My Website');
    expect(res.body).not.toContain('Hidden in the US');
    expect(res.body).not.toContain('Disabled Link');
    expect(res.body).not.toContain('countries-data');
  });

  test('shows country popup when the country is unknown', async () => {
    const res = await publicApp.inject({ url: '/', headers: { 'cf-ipcountry': 'XX' } });
    expect(res.body).toContain('countries-data');
  });

  test('/go redirects to visible links only', async () => {
    const blocked = db.getLinks().find((l) => l.title === 'Hidden in the US');
    const visible = db.getLinks().find((l) => l.title === 'My Website');

    const ok = await publicApp.inject({ url: `/go/${visible.id}`, headers: { 'cf-ipcountry': 'AT' } });
    expect(ok.statusCode).toBe(302);
    expect(ok.headers.location).toBe(visible.url);

    const denied = await publicApp.inject({ url: `/go/${blocked.id}`, headers: { 'cf-ipcountry': 'US' } });
    expect(denied.statusCode).toBe(404);
  });

  test('ignores invalid country cookies', async () => {
    const res = await publicApp.inject({ method: 'POST', url: '/select-country', ...form({ country: "'><script>" }) });
    expect(res.statusCode).toBe(303);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  test('tracks visits with a normalized referrer', async () => {
    const res = await publicApp.inject({
      method: 'POST',
      url: '/track',
      ...form({ fingerprint: 'abc', referrer: 'https://evil.example/</script><script>alert(1)</script>' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().userId).toBeGreaterThan(0);
  });
});

describe('admin', () => {
  test('requires authentication', async () => {
    expect((await adminApp.inject({ url: '/admin' })).statusCode).toBe(401);
    expect((await adminApp.inject({ url: '/healthz' })).statusCode).toBe(200);
    const res = await adminApp.inject({ url: '/admin', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Dashboard');
  });

  test('blocks cross-origin form posts', async () => {
    const req = form({ title: 'x', url: 'https://x.test' });
    req.headers.origin = 'https://attacker.example';
    const res = await adminApp.inject({ method: 'POST', url: '/admin/links', ...req });
    expect(res.statusCode).toBe(403);
  });

  test('rejects javascript: links', async () => {
    const res = await adminApp.inject({ method: 'POST', url: '/admin/links', ...form({ title: 'Bad', url: 'javascript:alert(1)' }) });
    expect(res.headers.location).toContain('error=invalid-url');
    expect(db.getLinks().some((l) => l.title === 'Bad')).toBe(false);
  });

  test('adds and edits a link', async () => {
    await adminApp.inject({ method: 'POST', url: '/admin/links', ...form({ title: 'New', url: 'example.org' }) });
    const link = db.getLinks().find((l) => l.title === 'New');
    expect(link.url).toBe('https://example.org/');

    await adminApp.inject({
      method: 'POST',
      url: `/admin/links/${link.id}`,
      ...form({ title: 'Renamed', url: 'https://example.org/x', countries: 'de, xx, at' }),
    });
    const updated = db.getLink(link.id);
    expect(updated.title).toBe('Renamed');
    expect(updated.blocked).toEqual(['DE', 'AT']);
  });

  test('rejects unsafe SVG icons', async () => {
    const res = await adminApp.inject({
      method: 'POST',
      url: '/admin/icon-links',
      ...form({ url: 'https://example.com', svg_code: '<svg onload="alert(1)"></svg>' }),
    });
    expect(res.headers.location).toContain('error=invalid-svg');
  });

  test('export/import round-trip and rejects unknown tables', async () => {
    const exported = await adminApp.inject({ url: '/admin/export', headers: auth });
    expect(exported.statusCode).toBe(200);

    const bad = await adminApp.inject({
      method: 'POST',
      url: '/admin/import',
      ...form({ dbContent: JSON.stringify({ tables: [{ name: 'sqlite_master', rows: [] }] }) }),
    });
    expect(bad.headers.location).toContain('error=import-failed');

    const good = await adminApp.inject({ method: 'POST', url: '/admin/import', ...form({ dbContent: exported.body }) });
    expect(good.headers.location).toContain('ok=imported');
  });

  test('analytics page escapes embedded data', async () => {
    const { addLinkClick } = await import('../lib/analytics_db.js');
    addLinkClick(1, 'https://x.test/</script><script>alert(1)</script>');
    const res = await adminApp.inject({ url: '/analytics', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.body).not.toContain('</script><script>alert(1)');
  });
});
