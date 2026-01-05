import {
  getLinks,
  addLink,
  toggleLink,
  updateLinkCountries,
  deleteLink,
  getSettings,
  updateSettings,
  toggleLink18Plus,
  getIconLinks,
  addIconLink,
  deleteIconLink,
  setActiveTheme,
  discoverThemes
} from '../lib/db.js';
import { getContrastingTextColor, createShade, createTint } from '../lib/colors.js';
import { exportDb, importDb } from '../lib/import_export.js';
import path from 'path';
import fs from 'fs';

async function adminRoutes(fastify, options) {
  const themesPath = path.join(process.cwd(), 'themes');

  // GET /admin/export - Export database content as JSON
  fastify.get('/admin/export', async (request, reply) => {
    const dbContent = exportDb();
    return reply.send(dbContent);
  });

  // POST /admin/import - Import database content from JSON
  fastify.post('/admin/import', async (request, reply) => {
    const { dbContent } = request.body;
    try {
      importDb(dbContent);
    } catch (e) {
      console.error("Import failed:", e);
      // You might want to add some error feedback to the user here
    }
    return reply.redirect('/admin');
  });

  // GET /admin - Display admin dashboard
  fastify.get('/admin', async (request, reply) => {
    const themes = discoverThemes(themesPath);
    const links = getLinks();
    const iconLinks = getIconLinks();
    const settings = getSettings() || {};
    const baseColor = settings.container_color || '#f0f0f0';

    // User adjustable factors (0.0 to 1.0)
    const BG_SHADE_FACTOR = 0.3;          // 30% shade for background
    const LINK_TINT_FACTOR = 0.9;         // 90% tint for links
    const TEXT_SHADE_FACTOR = 0.8;        // 80% shade for text
    const GRADIENT_SHADE_FACTOR = 0.05;   // 5% shade for gradient
    const GRADIENT_TINT_FACTOR = 0.01;    // 1% tint for gradient

    // Calculate container gradient colors
    const containerShade = createShade(baseColor, GRADIENT_SHADE_FACTOR);
    const containerTint = createTint(baseColor, GRADIENT_TINT_FACTOR);

    // Calculate background gradient colors
    const backgroundBaseColor = createShade(baseColor, BG_SHADE_FACTOR);
    const backgroundShade = createShade(backgroundBaseColor, GRADIENT_SHADE_FACTOR);
    const backgroundTint = createTint(backgroundBaseColor, GRADIENT_TINT_FACTOR);

    const textColor = createShade(baseColor, TEXT_SHADE_FACTOR);

    const theme = {
      containerGradient: `linear-gradient(to bottom, ${containerShade}, ${baseColor}, ${containerTint})`,
      backgroundGradient: `linear-gradient(to bottom, ${backgroundShade}, ${backgroundBaseColor}, ${backgroundTint})`,
      textColor: textColor,
      linkColor: createTint(baseColor, LINK_TINT_FACTOR),
      linkTextColor: textColor, // Same as main text color
    };

    // Load active theme files
    let themeContent = { html: '', css: '', js: '' };
    if (settings.active_theme) {
      const themePath = path.join(themesPath, settings.active_theme);
      try {
        themeContent.html = fs.readFileSync(path.join(themePath, 'index.html'), 'utf8');
        themeContent.css = fs.readFileSync(path.join(themePath, 'style.css'), 'utf8');
        themeContent.js = fs.readFileSync(path.join(themePath, 'script.js'), 'utf8');
      } catch (e) {
        console.error(`Error loading theme ${settings.active_theme}:`, e);
      }
    }

    return reply.view('admin', { links, iconLinks, settings, themes, theme, themeContent });
  });

  // POST /admin/profile - Update profile settings
  fastify.post('/admin/profile', async (request, reply) => {
    const { username, profile_pic_url, bio, page_title } = request.body;
    const settings = getSettings() || {};
    updateSettings(settings.container_color, username, profile_pic_url, bio, page_title, settings.active_theme);
    return reply.redirect('/admin');
  });

  // POST /admin/settings - Update theme settings
  fastify.post('/admin/settings', async (request, reply) => {
    const { containerColor } = request.body;
    const settings = getSettings() || {};
    updateSettings(containerColor, settings.username, settings.profile_pic_url, settings.bio, settings.page_title, settings.active_theme);
    return reply.redirect('/admin');
  });

  // POST /admin/themes/activate - Activate a theme
  fastify.post('/admin/themes/activate', async (request, reply) => {
    const { themeName } = request.body;
    setActiveTheme(themeName);
    return reply.redirect('/admin');
  });

  // POST /admin/themes/scan - Scan for new themes
  fastify.post('/admin/themes/scan', async (request, reply) => {
    discoverThemes(themesPath);
    return reply.redirect('/admin');
  });

  // POST /admin/themes/deactivate - Deactivate the active theme
  fastify.post('/admin/themes/deactivate', async (request, reply) => {
    setActiveTheme(null);
    return reply.redirect('/admin');
  });

  // POST /admin/icon-links - Add a new icon link
  fastify.post('/admin/icon-links', async (request, reply) => {
    const { url, svg_code } = request.body;
    addIconLink(url, svg_code);
    return reply.redirect('/admin');
  });

  // POST /admin/icon-links/:id/delete - Delete an icon link
  fastify.post('/admin/icon-links/:id/delete', async (request, reply) => {
    const { id } = request.params;
    deleteIconLink(id);
    return reply.redirect('/admin');
  });

  // POST /admin/links - Add a new link
  fastify.post('/admin/links', async (request, reply) => {
    const { title, url } = request.body;
    addLink(title, url);
    return reply.redirect('/admin');
  });

  // POST /admin/links/:id/toggle - Toggle link enabled/disabled state
  fastify.post('/admin/links/:id/toggle', async (request, reply) => {
    const { id } = request.params;
    toggleLink(id);
    return reply.redirect('/admin');
  });

  // POST /admin/links/:id/toggle-18-plus - Toggle 18+ status
  fastify.post('/admin/links/:id/toggle-18-plus', async (request, reply) => {
    const { id } = request.params;
    toggleLink18Plus(id);
    return reply.redirect('/admin');
  });

  // POST /admin/links/:id/countries - Update blocked countries for a link
  fastify.post('/admin/links/:id/countries', async (request, reply) => {
    const { id } = request.params;
    let { countries } = request.body;
    if (countries) {
      countries = JSON.stringify(countries.split(',').map(c => c.trim()).filter(c => c !== ''));
    } else {
      countries = '[]';
    }
    updateLinkCountries(id, countries);
    return reply.redirect('/admin');
  });

  // POST /admin/links/:id/delete - Delete a link
  fastify.post('/admin/links/:id/delete', async (request, reply) => {
    const { id } = request.params;
    deleteLink(id);
    return reply.redirect('/admin');
  });
}

export default adminRoutes;