import { getVisibleLinks, getSettings, getIconLinks } from '../lib/db.js';
import { getCountry } from '../lib/geo.js';
import { countries as countryList } from 'countries-list';
import { getContrastingTextColor, createShade, createTint } from '../lib/colors.js';

async function publicRoutes(fastify, options) {
  // The main public route that displays the links.
  fastify.get('/', async (request, reply) => {
    // 1. Determine the user's country. Prioritize the 'country' cookie.
    //    If the cookie is not set, fall back to the 'cf-ipcountry' header.
    let country = request.cookies.country || getCountry(request);
    let showCountryPopup = false;

    // 2. If no country can be determined, set a flag to show the popup.
    if (!country) {
      showCountryPopup = true;
    }

    // 3. Get the links that are visible for the determined country.
    const links = getVisibleLinks(country);

    // 4. Prepare the list of countries from the 'countries-list' package for the popup.
    const countries = Object.entries(countryList).map(([code, country]) => ({
      code,
      name: country.name,
    }));

    // 5. Get theme settings and calculate colors
    const settings = getSettings() || {};
    const baseColor = settings.container_color || '#f0f0f0';

    // User adjustable factors (0.0 to 1.0)
    const BG_SHADE_FACTOR = 0.3;          // 30% shade for background
    const LINK_TINT_FACTOR = 0.9;         // 90% tint for links
    const TEXT_SHADE_FACTOR = 0.9;        // 90% shade for text
    const GRADIENT_SHADE_FACTOR = 0.3;   // 30% shade for gradient
    const GRADIENT_TINT_FACTOR = 0.2;    // 20% tint for gradient

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

    const iconLinks = getIconLinks();

    // 6. Render the main page
    return reply.view('linktree', { links, iconLinks, settings, showCountryPopup, countries, theme });
  });

  // This route handles the country selection from the popup.
  fastify.post('/select-country', async (request, reply) => {
    const { country } = request.body;
    // Set a cookie with the selected country. This will be used in subsequent requests.
    reply.setCookie('country', country, { path: '/' });
    // Redirect the user back to the home page to see the filtered links.
    return reply.redirect('/');
  });
}

export default publicRoutes;
