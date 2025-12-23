import { getLinks, addLink, toggleLink, updateLinkCountries, deleteLink, getSettings, updateSettings } from '../lib/db.js';
import { getContrastingTextColor, createShade, createTint, getGradientColors, createReallyDarkShade } from '../lib/colors.js';

async function adminRoutes(fastify, options) {
  // GET /admin - Display admin dashboard
  fastify.get('/admin', async (request, reply) => {
    const links = getLinks();
    const settings = getSettings() || {};
    const baseColor = settings.container_color || '#f0f0f0';
    const gradient = getGradientColors(baseColor);

    const theme = {
        containerGradient: `linear-gradient(to bottom, ${gradient.shade}, ${gradient.base}, ${gradient.tint})`,
        backgroundGradient: `linear-gradient(to bottom, ${createShade(gradient.shade)}, ${gradient.shade}, ${gradient.base})`,
        textColor: createReallyDarkShade(baseColor),
        linkColor: createTint(baseColor),
        linkTextColor: getContrastingTextColor(createTint(baseColor)),
    };

    return reply.view('admin', { links: links, settings: settings, theme: theme });
  });

  // POST /admin/settings - Update theme settings
  fastify.post('/admin/settings', async (request, reply) => {
    const { containerColor } = request.body;
    updateSettings(containerColor);

    if (request.headers['hx-request']) {
      const links = getLinks();
      const settings = getSettings();
      const baseColor = settings.container_color || '#f0f0f0';
      const gradient = getGradientColors(baseColor);
      const theme = {
        containerGradient: `linear-gradient(to bottom, ${gradient.shade}, ${gradient.base}, ${gradient.tint})`,
        backgroundGradient: `linear-gradient(to bottom, ${createShade(gradient.shade)}, ${gradient.shade}, ${gradient.base})`,
        textColor: createReallyDarkShade(baseColor),
        linkColor: createTint(baseColor),
        linkTextColor: getContrastingTextColor(createTint(baseColor)),
      };
      return reply.view('admin', { links: links, settings: settings, theme: theme });
    }

    return reply.redirect('/admin');
  });

  // POST /admin/links - Add a new link
  fastify.post('/admin/links', async (request, reply) => {
    const { title, url } = request.body;
    addLink(title, url);
    const links = getLinks();
    return reply.view('partials/link-list', { links: links }); // Assuming a partial for link list
  });

  // POST /admin/links/:id/toggle - Toggle link enabled/disabled state
  fastify.post('/admin/links/:id/toggle', async (request, reply) => {
    const { id } = request.params;
    toggleLink(id);
    const links = getLinks();
    return reply.view('partials/link-list', { links: links });
  });

  // POST /admin/links/:id/countries - Update blocked countries for a link
  fastify.post('/admin/links/:id/countries', async (request, reply) => {
    const { id } = request.params;
    let { countries } = request.body;
    // Convert comma-separated string to JSON array string
    if (countries) {
      countries = JSON.stringify(countries.split(',').map(c => c.trim()).filter(c => c !== ''));
    } else {
      countries = '[]'; // Store an empty JSON array if no countries are provided
    }
    updateLinkCountries(id, countries);
    const links = getLinks();
    return reply.view('partials/link-list', { links: links });
  });

  // DELETE /admin/links/:id - Delete a link
  fastify.delete('/admin/links/:id', async (request, reply) => {
    const { id } = request.params;
    deleteLink(id);
    const links = getLinks();
    return reply.view('partials/link-list', { links: links });
  });
}

export default adminRoutes;