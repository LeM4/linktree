import { getVisibleLinks, getSettings } from '../lib/db.js';
import { getCountry } from '../lib/geo.js';
import { countries as countryList } from 'countries-list';
import { getContrastingTextColor, createShade, createTint, getGradientColors, createReallyDarkShade } from '../lib/colors.js';

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
    const gradient = getGradientColors(baseColor);

    const theme = {
      containerGradient: `linear-gradient(to bottom, ${gradient.shade}, ${gradient.base}, ${gradient.tint})`,
      backgroundGradient: `linear-gradient(to bottom, ${createShade(gradient.shade)}, ${gradient.shade}, ${gradient.base})`,
      textColor: createReallyDarkShade(baseColor), // Text color based on the base color
      linkColor: createTint(baseColor),
      linkTextColor: getContrastingTextColor(createTint(baseColor)),
    };

    // 6. Render the main page, passing the links, flags for the popup, and theme colors.
    return reply.view('linktree', { links, showCountryPopup, countries, theme });
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
