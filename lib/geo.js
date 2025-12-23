/**
 * Gets the user's country from the 'cf-ipcountry' header.
 * This header is expected to be provided by Cloudflare.
 * @param {object} request - The Fastify request object.
 * @returns {string|null} The two-letter country code (e.g., 'US') or null if the header is not present.
 */
export function getCountry(request) {
  return request.headers['cf-ipcountry'] || null;
}
