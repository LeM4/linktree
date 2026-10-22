// --- Color Conversion Helpers ---

/**
 * Converts a single sRGB color component to its linear equivalent.
 * @param {number} srgb - The sRGB component (0-255).
 * @returns {number} The linear RGB component (0-1).
 */
function srgbToLinear(srgb) {
    const v = srgb / 255;
    return Math.pow(v, 2.2);
}

/**
 * Converts a single linear RGB color component to its sRGB equivalent.
 * @param {number} linear - The linear RGB component (0-1).
 * @returns {number} The sRGB component (0-255).
 */
function linearToSrgb(linear) {
    const v = Math.pow(linear, 1 / 2.2);
    return Math.round(v * 255);
}

/**
 * Converts a hex color string to an array of linear RGB components.
 * @param {string} hexColor - The color in hex format.
 * @returns {number[]} An array of [r, g, b] in linear format (0-1).
 */
function hexToLinear(hexColor) {
    if (!hexColor) return [0, 0, 0];
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

/**
 * Converts an array of linear RGB components to a hex color string.
 * @param {number[]} linear - An array of [r, g, b] in linear format (0-1).
 * @returns {string} The color in hex format.
 */
function linearToHex(linear) {
    const r = linearToSrgb(linear[0]).toString(16).padStart(2, '0');
    const g = linearToSrgb(linear[1]).toString(16).padStart(2, '0');
    const b = linearToSrgb(linear[2]).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
}


// --- Public API ---

/**
 * Calculates a contrasting text color (black or white) for a given background color.
 * This function uses the YIQ formula, which works on sRGB values.
 * @param {string} hexColor - The background color in hex format (e.g., '#RRGGBB').
 * @returns {string} '#000000' for black or '#ffffff' for white.
 */
function getContrastingTextColor(hexColor) {
  if (!hexColor) return '#000000';
  const r = parseInt(hexColor.substr(1, 2), 16);
  const g = parseInt(hexColor.substr(3, 2), 16);
  const b = parseInt(hexColor.substr(5, 2), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * Creates a shade (darker version) of a color.
 * @param {string} hexColor - The base color.
 * @param {number} factor - The factor to darken by (0.0 to 1.0, where 1.0 is black and 0.0 is no shade).
 * @returns {string} The shade color.
 */
function createShade(hexColor, factor) {
    if (!hexColor) return '#000000';
    const linear = hexToLinear(hexColor);
    const shadedLinear = linear.map(c => c * (1 - factor));
    return linearToHex(shadedLinear);
}

/**
 * Creates a tint (brighter version) of a color.
 * @param {string} hexColor - The base color.
 * @param {number} factor - The factor to brighten by (0.0 to 1.0, where 1.0 is white and 0.0 is no tint).
 * @returns {string} The tint color.
 */
function createTint(hexColor, factor) {
    if (!hexColor) return '#ffffff';
    const linear = hexToLinear(hexColor);
    const tintedLinear = linear.map(c => c + (1 - c) * factor);
    return linearToHex(tintedLinear);
}


/** Linear-light mix of two hex colors; t = 0 gives `a`, t = 1 gives `b`. */
function mixHex(a, b, t) {
    const la = hexToLinear(a);
    const lb = hexToLinear(b);
    return linearToHex(la.map((v, i) => v + (lb[i] - v) * t));
}

/** WCAG relative luminance (0 = black, 1 = white). */
function luminance(hexColor) {
    const [r, g, b] = [1, 3, 5].map((i) => {
        const c = parseInt(hexColor.substr(i, 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Gamma-space mix, closer to how designers blend colors; t = 0 gives `a`, t = 1 gives `b`. */
function mixSrgb(a, b, t) {
    const ch = (hex, i) => parseInt(hex.substr(i, 2), 16);
    return `#${[1, 3, 5]
        .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t).toString(16).padStart(2, '0'))
        .join('')}`;
}

export { getContrastingTextColor, createShade, createTint, mixHex, mixSrgb, luminance };
