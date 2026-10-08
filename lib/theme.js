import fs from 'fs';
import path from 'path';
import config from './config.js';
import { createShade, createTint } from './colors.js';
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

/** Derives the public page palette from the single base color. */
export function buildPalette(baseColor) {
  const base = isHexColor(baseColor) ? baseColor : '#f0f0f0';
  const background = createShade(base, 0.3);
  const text = createShade(base, 0.9);
  return {
    base,
    containerGradient: `linear-gradient(to bottom, ${createShade(base, 0.3)}, ${base}, ${createTint(base, 0.2)})`,
    backgroundGradient: `linear-gradient(to bottom, ${createShade(background, 0.3)}, ${background}, ${createTint(background, 0.2)})`,
    textColor: text,
    linkColor: createTint(base, 0.9),
    linkTextColor: text,
  };
}
