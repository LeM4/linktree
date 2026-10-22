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

describe('themes', () => {
  test('ship metadata and colors', async () => {
    const { listThemes } = await import('../lib/theme.js');
    const themes = Object.fromEntries(listThemes().map((t) => [t.id, t]));
    expect(themes.halloween.colors.link).toMatch(/^#[0-9a-f]{6}$/);
    expect(themes.autumn.colors.background).toMatch(/^#[0-9a-f]{6}$/);
    expect(themes.snowfall.colors).toBeNull();
  });

  test('colors can be overridden, reset, and fall back to the base color', async () => {
    const { getThemeMeta } = await import('../lib/theme.js');
    const defaults = getThemeMeta('halloween').colors;
    const page = async () => (await publicApp.inject({ url: '/', headers: { 'cf-ipcountry': 'AT' } })).body;

    await adminApp.inject({ method: 'POST', url: '/admin/appearance', ...form({ containerColor: '#123456' }) });
    await adminApp.inject({ method: 'POST', url: '/admin/themes/activate', ...form({ themeName: 'halloween' }) });
    expect(await page()).toContain(`--link-color: ${defaults.link}`);
    expect(await page()).toContain('id="theme-halloween"');

    const res = await adminApp.inject({ method: 'POST', url: '/admin/themes/colors', ...form({ ...defaults, link: '#00ff00' }) });
    expect(res.headers.location).toContain('ok=theme-colors');
    expect(await page()).toContain('--link-color: #00ff00');
    expect(JSON.parse(db.getSettings().theme_overrides)).toEqual({ halloween: { link: '#00ff00' } });

    const bad = await adminApp.inject({ method: 'POST', url: '/admin/themes/colors', ...form({ ...defaults, text: 'red' }) });
    expect(bad.headers.location).toContain('error=invalid-color');

    await adminApp.inject({ method: 'POST', url: '/admin/themes/colors/reset', ...form({}) });
    expect(await page()).toContain(`--link-color: ${defaults.link}`);

    await adminApp.inject({ method: 'POST', url: '/admin/themes/deactivate', ...form({}) });
    expect(await page()).not.toContain('theme-halloween');
    expect(db.getSettings().container_color).toBe('#123456');
    expect((await adminApp.inject({ url: '/admin', headers: auth })).body).toContain('value="#123456"');
  });
});

describe('stats', () => {
  let stats;
  let a;

  beforeAll(async () => {
    a = await import('../lib/analytics_db.js');
    stats = await import('../lib/stats.js');
    a.db.run('DELETE FROM link_clicks');
    a.db.run('DELETE FROM visitations');

    const visit = (country, referrer, clicks = []) => {
      const id = a.addVisitation(a.findOrCreateUser(`fp-${Math.random()}`).id, country, referrer, 'ua');
      clicks.forEach((url) => a.addLinkClick(id, url));
    };
    for (let i = 0; i < 6; i++) visit('AT', 'https://instagram.com/', ['https://a.test/']);
    for (let i = 0; i < 3; i++) visit('DE', '', ['https://b.test/']);
    visit('DE', '', ['https://a.test/']);
    visit(null, '', []);
    // A visit 40 days ago only counts for "all" and for the previous 30-day period.
    a.db.run("INSERT INTO visitations (user_id, country, referrer, timestamp) VALUES (1, 'US', '', datetime('now', 'localtime', '-40 days'))");
  });

  test('computes KPIs, deltas and per-country numbers', () => {
    const s = stats.getStats('30d');
    expect(s.kpis.visits).toBe(11);
    expect(s.kpis.clicks).toBe(10);
    expect(s.kpis.ctr).toBeCloseTo(10 / 11);
    expect(s.previous.visits).toBe(1);
    expect(s.deltas.visits).toBeCloseTo(10);
    expect(s.countries[0]).toMatchObject({ code: 'AT', visits: 6, clicks: 6 });
    expect(s.trend.visits.reduce((x, y) => x + y, 0)).toBe(11);
    expect(stats.getStats('all').kpis.visits).toBe(12);
  });

  test('builds the country x link matrix and heatmap', () => {
    const { matrix, heatmaps } = stats.getStats('7d');
    const de = matrix.rows.find((r) => r.code === 'DE');
    const bIndex = matrix.links.findIndex((l) => l.url === 'https://b.test/');
    expect(de.total).toBe(4);
    expect(de.best).toBe(bIndex);
    expect(de.cells[bIndex].share).toBeCloseTo(0.75);
    expect(heatmaps.clicks.total).toBe(10);
    expect(heatmaps.clicks.peak.n).toBe(10);
  });

  test('focus and exclusions narrow the numbers', () => {
    expect(stats.getStats('30d', { country: 'DE' }).kpis.visits).toBe(4);
    expect(stats.getStats('30d', { country: '' }).kpis.visits).toBe(1);
    expect(stats.getStats('30d', { excludedReferrers: [''] }).kpis.visits).toBe(6);
    expect(stats.getStats('30d', { excludedLinks: ['https://a.test/'] }).kpis.clicks).toBe(3);
    // The map keeps showing every country while focused.
    expect(stats.getStats('30d', { country: 'DE' }).countries.length).toBe(3);
  });

  test('renders the dashboard with map, heatmap and matrix', async () => {
    const res = await adminApp.inject({ url: '/analytics?range=7d&country=DE', headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('Where visitors come from');
    expect(res.body).toContain('What each country clicks');
    expect(res.body).toContain('When fans are active');
    expect(res.body).toContain('Germany');

    const bad = await adminApp.inject({ url: '/analytics?range=evil&country=%3Cscript%3E', headers: auth });
    expect(bad.statusCode).toBe(200);
    expect(bad.body).not.toContain('<script>alert');
  });
});
