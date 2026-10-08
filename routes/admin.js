import {
  getLinks,
  getLink,
  addLink,
  updateLink,
  toggleLink,
  toggleLink18Plus,
  deleteLink,
  moveLink,
  getSettings,
  updateSettings,
  setActiveTheme,
  getIconLinks,
  addIconLink,
  deleteIconLink,
  moveIconLink,
} from '../lib/db.js';
import { exportDb, importDb } from '../lib/import_export.js';
import { discoverThemes, isKnownTheme, buildPalette } from '../lib/theme.js';
import { safeUrl, parseCountryList, isHexColor, clampText } from '../lib/validate.js';
import config from '../lib/config.js';

const MESSAGES = {
  ok: {
    profile: 'Profile saved',
    appearance: 'Appearance saved',
    theme: 'Background theme updated',
    'link-added': 'Link added',
    'link-saved': 'Link saved',
    'link-deleted': 'Link deleted',
    'link-updated': 'Link updated',
    'icon-added': 'Icon link added',
    'icon-deleted': 'Icon link deleted',
    'icon-updated': 'Icon link updated',
    imported: 'Backup imported',
  },
  error: {
    'invalid-url': 'Please enter a valid http(s) URL',
    'missing-title': 'Please enter a title',
    'invalid-color': 'Please pick a valid color',
    'invalid-image': 'Profile picture must be an image URL or upload',
    'invalid-svg': 'SVG must start with <svg> and must not contain scripts or event handlers',
    'unknown-theme': 'Theme not found',
    'import-failed': 'Import failed – please check the JSON',
    'not-found': 'That item no longer exists',
  },
};

const MAX_IMAGE_DATA_URL = 1.5 * 1024 * 1024;
const DATA_IMAGE = /^data:image\/(png|jpe?g|webp|gif|avif|svg\+xml);base64,[a-z0-9+/=]+$/i;
const UNSAFE_SVG = /<script|<foreignobject|\son[a-z]+\s*=|javascript:/i;

function profileImage(value) {
  const input = typeof value === 'string' ? value.trim() : '';
  if (!input) return '';
  if (input.startsWith('data:')) return input.length <= MAX_IMAGE_DATA_URL && DATA_IMAGE.test(input) ? input : null;
  return safeUrl(input);
}

async function adminRoutes(fastify) {
  const done = (reply, { ok, error, section }) => {
    const query = ok ? `ok=${ok}` : `error=${error}`;
    return reply.redirect(`/admin?${query}${section ? `#${section}` : ''}`, 303);
  };
  const id = (request) => Number(request.params.id);

  fastify.get('/', (request, reply) => reply.redirect('/admin', 302));

  fastify.get('/admin', async (request, reply) => {
    const { ok, error } = request.query;
    const settings = getSettings() || {};
    const flash =
      (MESSAGES.ok[ok] && { type: 'success', message: MESSAGES.ok[ok] }) ||
      (MESSAGES.error[error] && { type: 'error', message: MESSAGES.error[error] }) ||
      null;

    reply.header('Cache-Control', 'no-store');
    return reply.view('admin', {
      page: 'admin',
      settings,
      links: getLinks(),
      iconLinks: getIconLinks(),
      themes: discoverThemes(),
      palette: buildPalette(settings.container_color),
      publicUrl: config.publicUrl,
      flash,
    });
  });

  // --- Profile & appearance ---------------------------------------------------

  fastify.post('/admin/profile', async (request, reply) => {
    const body = request.body || {};
    const image = profileImage(body.profile_pic_url);
    if (image === null) return done(reply, { error: 'invalid-image', section: 'profile' });

    updateSettings({
      username: clampText(body.username, 100),
      page_title: clampText(body.page_title, 120),
      bio: clampText(body.bio, 1000),
      profile_pic_url: image,
    });
    return done(reply, { ok: 'profile', section: 'profile' });
  });

  fastify.post('/admin/appearance', async (request, reply) => {
    const color = String(request.body?.containerColor || '').toLowerCase();
    if (!isHexColor(color)) return done(reply, { error: 'invalid-color', section: 'appearance' });
    updateSettings({ container_color: color });
    return done(reply, { ok: 'appearance', section: 'appearance' });
  });

  fastify.post('/admin/themes/activate', async (request, reply) => {
    const name = request.body?.themeName;
    if (!isKnownTheme(name)) return done(reply, { error: 'unknown-theme', section: 'appearance' });
    setActiveTheme(name);
    return done(reply, { ok: 'theme', section: 'appearance' });
  });

  fastify.post('/admin/themes/deactivate', async (request, reply) => {
    setActiveTheme(null);
    return done(reply, { ok: 'theme', section: 'appearance' });
  });

  // --- Links ---------------------------------------------------------------------

  fastify.post('/admin/links', async (request, reply) => {
    const title = clampText(request.body?.title, 200);
    const url = safeUrl(request.body?.url);
    if (!title) return done(reply, { error: 'missing-title', section: 'links' });
    if (!url) return done(reply, { error: 'invalid-url', section: 'links' });
    addLink(title, url);
    return done(reply, { ok: 'link-added', section: 'links' });
  });

  fastify.post('/admin/links/:id', async (request, reply) => {
    if (!getLink(id(request))) return done(reply, { error: 'not-found', section: 'links' });
    const title = clampText(request.body?.title, 200);
    const url = safeUrl(request.body?.url);
    if (!title) return done(reply, { error: 'missing-title', section: 'links' });
    if (!url) return done(reply, { error: 'invalid-url', section: 'links' });
    updateLink(id(request), { title, url, blocked: parseCountryList(request.body?.countries) });
    return done(reply, { ok: 'link-saved', section: 'links' });
  });

  fastify.post('/admin/links/:id/toggle', async (request, reply) => {
    toggleLink(id(request));
    return done(reply, { ok: 'link-updated', section: 'links' });
  });

  fastify.post('/admin/links/:id/toggle-18-plus', async (request, reply) => {
    toggleLink18Plus(id(request));
    return done(reply, { ok: 'link-updated', section: 'links' });
  });

  fastify.post('/admin/links/:id/move', async (request, reply) => {
    moveLink(id(request), request.body?.direction === 'up' ? 'up' : 'down');
    return done(reply, { ok: 'link-updated', section: 'links' });
  });

  fastify.post('/admin/links/:id/delete', async (request, reply) => {
    deleteLink(id(request));
    return done(reply, { ok: 'link-deleted', section: 'links' });
  });

  // --- Icon links ----------------------------------------------------------------

  fastify.post('/admin/icon-links', async (request, reply) => {
    const url = safeUrl(request.body?.url);
    const svg = clampText(request.body?.svg_code, 20000);
    if (!url) return done(reply, { error: 'invalid-url', section: 'icons' });
    if (!/^<svg[\s>]/i.test(svg) || UNSAFE_SVG.test(svg)) return done(reply, { error: 'invalid-svg', section: 'icons' });
    addIconLink(url, svg);
    return done(reply, { ok: 'icon-added', section: 'icons' });
  });

  fastify.post('/admin/icon-links/:id/move', async (request, reply) => {
    moveIconLink(id(request), request.body?.direction === 'up' ? 'up' : 'down');
    return done(reply, { ok: 'icon-updated', section: 'icons' });
  });

  fastify.post('/admin/icon-links/:id/delete', async (request, reply) => {
    deleteIconLink(id(request));
    return done(reply, { ok: 'icon-deleted', section: 'icons' });
  });

  // --- Backup --------------------------------------------------------------------

  fastify.get('/admin/export', async (request, reply) => {
    const date = new Date().toISOString().slice(0, 10);
    reply.header('Content-Disposition', `attachment; filename="linktree-backup-${date}.json"`);
    reply.header('Cache-Control', 'no-store');
    return reply.type('application/json').send(JSON.stringify(exportDb(), null, 2));
  });

  fastify.post('/admin/import', async (request, reply) => {
    try {
      importDb(String(request.body?.dbContent || ''));
    } catch (err) {
      request.log.warn({ err }, 'Import failed');
      return done(reply, { error: 'import-failed', section: 'backup' });
    }
    return done(reply, { ok: 'imported', section: 'backup' });
  });
}

export default adminRoutes;
