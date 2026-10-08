import { getVisibleLinks, getLink, isVisible, getSettings, getIconLinks } from '../lib/db.js';
import { findOrCreateUser, addVisitation, addLinkClick } from '../lib/analytics_db.js';
import { getCountry } from '../lib/geo.js';
import { buildPalette, loadTheme } from '../lib/theme.js';
import { inferReferrerFromUserAgent } from '../lib/user-agent-helper.js';
import { countryOptions, isCountryCode, normalizeReferrer, clampText } from '../lib/validate.js';

const YEAR = 60 * 60 * 24 * 365;

async function publicRoutes(fastify) {
  const cookieOptions = (request, maxAge) => ({
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: request.protocol === 'https',
    maxAge,
  });

  fastify.get('/', async (request, reply) => {
    const country = getCountry(request);
    const settings = getSettings() || {};

    reply.header('Cache-Control', 'no-store');
    return reply.view('linktree', {
      settings,
      country,
      links: getVisibleLinks(country),
      iconLinks: getIconLinks(),
      palette: buildPalette(settings.container_color),
      themeContent: loadTheme(settings.active_theme),
      showCountryPopup: !country,
      countries: country ? [] : countryOptions,
    });
  });

  fastify.post('/select-country', async (request, reply) => {
    const code = String(request.body?.country || '').toUpperCase();
    if (isCountryCode(code)) reply.setCookie('country', code, cookieOptions(request, YEAR));
    return reply.redirect('/', 303);
  });

  fastify.post('/track', async (request, reply) => {
    const body = request.body || {};
    const userAgent = request.headers['user-agent'] || '';
    let referrer = normalizeReferrer(clampText(body.referrer, 2048));
    // Reloads and the country-popup redirect are not real referrals.
    if (referrer && new URL(referrer).host === request.host) referrer = '';
    referrer = normalizeReferrer(inferReferrerFromUserAgent(userAgent, referrer));
    const userId = Number.parseInt(body.userId, 10);

    const user = findOrCreateUser(clampText(body.fingerprint, 128) || null, Number.isInteger(userId) ? userId : null);
    const visitationId = addVisitation(user.id, getCountry(request), referrer, userAgent);

    reply.setCookie('visitationId', String(visitationId), cookieOptions(request, 60 * 60 * 24));
    return { ok: true, userId: user.id };
  });

  // Redirects through the server so clicks work without JS and can be counted,
  // without turning the endpoint into an open redirect.
  fastify.get('/go/:id', async (request, reply) => {
    const link = getLink(Number(request.params.id));
    if (!isVisible(link, getCountry(request))) return reply.code(404).type('text/plain').send('Link not found');

    const visitationId = Number.parseInt(request.cookies.visitationId, 10);
    if (Number.isInteger(visitationId)) addLinkClick(visitationId, link.url);

    reply.header('Cache-Control', 'no-store');
    return reply.redirect(link.url, 302);
  });
}

export default publicRoutes;
