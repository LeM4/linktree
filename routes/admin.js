import { getLinks, addLink, toggleLink, updateLinkCountries, deleteLink, getSettings, updateSettings } from '../lib/db.js';
import { getContrastingTextColor, createShade, createTint } from '../lib/colors.js';

async function adminRoutes(fastify, options) {
  // GET /admin - Display admin dashboard
  fastify.get('/admin', async (request, reply) => {
    const links = getLinks();
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

    return reply.view('admin', { links: links, settings: settings, theme: theme });
  });

  // POST /admin/settings - Update theme settings
  fastify.post('/admin/settings', async (request, reply) => {
    const { containerColor } = request.body;
    updateSettings(containerColor);
    return reply.redirect('/admin');
  });

  // ... (other routes remain the same)
}

export default adminRoutes;