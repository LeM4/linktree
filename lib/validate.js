import { countries } from 'countries-list';

export const COUNTRY_CODES = new Set(Object.keys(countries));

export const countryOptions = Object.entries(countries)
  .map(([code, c]) => ({ code, name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export function isCountryCode(value) {
  return typeof value === 'string' && COUNTRY_CODES.has(value.toUpperCase());
}

/** Parses "at, de ,XX" into ["AT","DE"], dropping unknown codes and duplicates. */
export function parseCountryList(value) {
  const parts = Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/);
  return [...new Set(parts.map((c) => c.trim().toUpperCase()).filter((c) => COUNTRY_CODES.has(c)))];
}

/** Returns a normalized http(s) URL or null. Rejects javascript:, data:, etc. */
export function safeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let input = value.trim();
  if (!/^[a-z][a-z0-9+.-]*:/i.test(input)) input = `https://${input}`;
  try {
    const url = new URL(input);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/** Reduces a referrer to its origin so we don't store paths or query tokens. */
export function normalizeReferrer(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return `${url.protocol}//${url.host.replace(/^www\./, '')}/`;
  } catch {
    return '';
  }
}

export function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
}

export function clampText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
