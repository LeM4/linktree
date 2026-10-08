import { describe, expect, test } from 'bun:test';
import { safeUrl, parseCountryList, normalizeReferrer, isCountryCode, isHexColor } from '../lib/validate.js';
import { createShade, createTint, getContrastingTextColor } from '../lib/colors.js';
import { addFilter, removeFilter, parseFilterParam } from '../lib/view-helpers.js';
import { inferReferrerFromUserAgent } from '../lib/user-agent-helper.js';

describe('validate', () => {
  test('safeUrl only allows http(s)', () => {
    expect(safeUrl('https://example.com/a?b=1')).toBe('https://example.com/a?b=1');
    expect(safeUrl('example.com')).toBe('https://example.com/');
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('data:text/html,hi')).toBeNull();
    expect(safeUrl('')).toBeNull();
  });

  test('parseCountryList normalizes and drops unknown codes', () => {
    expect(parseCountryList('at, de ,XX, de')).toEqual(['AT', 'DE']);
    expect(parseCountryList('')).toEqual([]);
  });

  test('normalizeReferrer keeps only the origin', () => {
    expect(normalizeReferrer('https://www.instagram.com/p/abc?token=secret')).toBe('https://instagram.com/');
    expect(normalizeReferrer('javascript:alert(1)')).toBe('');
    expect(normalizeReferrer('not a url')).toBe('');
  });

  test('country and color checks', () => {
    expect(isCountryCode('at')).toBe(true);
    expect(isCountryCode('XX')).toBe(false);
    expect(isHexColor('#a1b2c3')).toBe(true);
    expect(isHexColor('red; background:url(x)')).toBe(false);
  });
});

describe('colors', () => {
  test('shade and tint stay valid hex colors', () => {
    expect(createShade('#ffffff', 1)).toBe('#000000');
    expect(createTint('#000000', 1)).toBe('#ffffff');
    expect(createShade('#808080', 0.5)).toMatch(/^#[0-9a-f]{6}$/);
    expect(getContrastingTextColor('#ffffff')).toBe('#000000');
  });
});

describe('view helpers', () => {
  test('add and remove analytics filters', () => {
    const added = addFilter({ excludedCountries: 'AT' }, 'excludedCountries', 'DE');
    expect(parseFilterParam(new URLSearchParams(added).getAll('excludedCountries'))).toEqual(['AT', 'DE']);
    expect(removeFilter({ excludedCountries: 'AT,DE' }, 'excludedCountries', 'AT')).toBe('?excludedCountries=DE');
    expect(addFilter({}, 'excludedReferrers', '')).toBe('?excludedReferrers=unknown');
  });
});

describe('user agent referrer inference', () => {
  test('detects in-app browsers', () => {
    expect(inferReferrerFromUserAgent('Mozilla/5.0 ... musical_ly_2023', '')).toBe('https://tiktok.com/');
    expect(inferReferrerFromUserAgent('Mozilla/5.0 ... Instagram 300.0', '')).toBe('https://instagram.com/');
    expect(inferReferrerFromUserAgent('Mozilla/5.0', 'https://x.com/')).toBe('https://x.com/');
    expect(inferReferrerFromUserAgent('Mozilla/5.0', '')).toBe('');
  });
});
