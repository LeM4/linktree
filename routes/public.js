import { getVisibleLinks } from '../lib/db.js';
import { getCountry } from '../lib/geo.js';
import { countries as countryList } from 'countries-list';

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

    // 5. Render the main page, passing the links and flags for the popup.
    return reply.view('linktree', { links, showCountryPopup, countries });
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
