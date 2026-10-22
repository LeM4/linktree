import fs from 'fs';
import path from 'path';
import config from './config.js';
import { mixSrgb, luminance } from './colors.js';
import { isHexColor } from './validate.js';

const THEME_NAME = /^[a-z0-9][a-z0-9_-]*$/i;

/** Lists theme folders inside the themes directory. */
export function discoverThemes(themesDir = config.themesDir) {
  if (!fs.existsSync(themesDir)) return [];
  return fs
    .readdirSync(themesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && THEME_NAME.test(d.name))
    .map((d) => d.name)
    .sort();
}

export function isKnownTheme(name, themesDir = config.themesDir) {
  return typeof name === 'string' && discoverThemes(themesDir).includes(name);
}

/** Reads index.html / style.css / script.js of the active theme (each optional). */
export function loadTheme(name, themesDir = config.themesDir) {
  const content = { html: '', css: '', js: '' };
  if (!isKnownTheme(name, themesDir)) return content;
  const dir = path.join(themesDir, name);
  const read = (file) => {
    try {
      return fs.readFileSync(path.join(dir, file), 'utf8');
    } catch {
      return '';
    }
  };
  content.html = read('index.html');
  content.css = read('style.css');
  content.js = read('script.js');
  return content;
}

const isLight = (hex) => luminance(hex) > 0.36;

/**
 * Palette derived from the admin's single base color (no theme): the color becomes the
 * page background, text is a near-black/near-white tinted towards it, and buttons are
 * frosted glass so they work on any hue.
 */
export function buildPalette(baseColor) {
  const base = isHexColor(baseColor) ? baseColor.toLowerCase() : '#f0f0f0';
  const light = isLight(base);
  const text = light ? mixSrgb('#0a0a0b', base, 0.1) : mixSrgb('#fafafa', base, 0.08);
  return {
    base,
    scheme: light ? 'light' : 'dark',
    background: base,
    text,
    link: light ? 'rgb(255 255 255 / 0.72)' : 'rgb(255 255 255 / 0.08)',
    linkText: text,
    accent: light ? mixSrgb(base, '#000000', 0.35) : mixSrgb(base, '#ffffff', 0.35),
    glass: true,
  };
}

/** Color tokens a theme can ship in theme.json and the admin can override. */
export const COLOR_TOKENS = [
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'link', label: 'Buttons' },
  { key: 'linkText', label: 'Button text' },
  { key: 'accent', label: 'Accent' },
];

function pickColors(input) {
  if (!input || typeof input !== 'object') return {};
  return Object.fromEntries(
    COLOR_TOKENS.filter(({ key }) => isHexColor(input[key])).map(({ key }) => [key, input[key].toLowerCase()])
  );
}

/** Reads themes/<name>/theme.json. Colors are only used when all tokens are valid. */
export function getThemeMeta(name, themesDir = config.themesDir) {
  if (!isKnownTheme(name, themesDir)) return null;
  let raw = {};
  try {
    raw = JSON.parse(fs.readFileSync(path.join(themesDir, name, 'theme.json'), 'utf8'));
  } catch {
    // theme.json is optional
  }
  const colors = pickColors(raw.colors);
  return {
    id: name,
    name: typeof raw.name === 'string' ? raw.name.slice(0, 40) : name,
    description: typeof raw.description === 'string' ? raw.description.slice(0, 120) : '',
    colors: Object.keys(colors).length === COLOR_TOKENS.length ? colors : null,
  };
}

export function listThemes(themesDir = config.themesDir) {
  return discoverThemes(themesDir).map((name) => getThemeMeta(name, themesDir));
}

export function parseOverrides(raw) {
  try {
    const value = JSON.parse(raw || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

/** Effective colors of a theme: its defaults with the admin's overrides on top. */
export function themeColors(meta, overridesRaw) {
  if (!meta?.colors) return null;
  return { ...meta.colors, ...pickColors(parseOverrides(overridesRaw)[meta.id]) };
}

export function paletteFromColors(c) {
  return {
    base: c.background,
    scheme: isLight(c.background) ? 'light' : 'dark',
    background: c.background,
    text: c.text,
    link: c.link,
    linkText: c.linkText,
    accent: c.accent,
    glass: false,
  };
}

/**
 * Palette for the public page: a theme with colors wins; without one the admin's own
 * base color is used, so switching back to "None" restores the previous look.
 */
export function resolvePalette(settings = {}) {
  const colors = themeColors(getThemeMeta(settings.active_theme), settings.theme_overrides);
  return colors ? paletteFromColors(colors) : buildPalette(settings.container_color);
}
