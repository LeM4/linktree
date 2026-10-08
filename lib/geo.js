import { isCountryCode } from './validate.js';

/**
 * Determines the visitor's country: an explicit `country` cookie (set via the
 * country popup) wins, otherwise Cloudflare's `CF-IPCountry` header is used.
 * Cloudflare sends `XX` (unknown) or `T1` (Tor) which are treated as unknown.
 * @returns {string|null} ISO 3166-1 alpha-2 code or null.
 */
export function getCountry(request) {
  for (const value of [request.cookies?.country, request.headers['cf-ipcountry']]) {
    if (isCountryCode(value)) return value.toUpperCase();
  }
  return null;
}
