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
 * @returns {string} The shade color.
 */
function createShade(hexColor) {
    if (!hexColor) return '#000000';
    const linear = hexToLinear(hexColor);
    // Multiply each component by 0.8 (for a 20% shade)
    const shadedLinear = linear.map(c => c * 0.8);
    return linearToHex(shadedLinear);
}

/**
 * Creates a really dark shade of a color for text.
 * @param {string} hexColor - The base color.
 * @returns {string} The very dark shade color.
 */
function createReallyDarkShade(hexColor) {
    if (!hexColor) return '#000000';
    const linear = hexToLinear(hexColor);
    // Multiply each component by 0.2 (for an 80% shade)
    const shadedLinear = linear.map(c => c * 0.2);
    return linearToHex(shadedLinear);
}

/**
 * Creates a tint (brighter version) of a color.
 * @param {string} hexColor - The base color.
 * @returns {string} The tint color.
 */
function createTint(hexColor) {
    if (!hexColor) return '#ffffff';
    const linear = hexToLinear(hexColor);
    // Add 50% of the difference to white
    const tintedLinear = linear.map(c => c + (1 - c) * 0.5);
    return linearToHex(tintedLinear);
}

/**
 * Generates a set of colors for a gradient.
 * @param {string} hexColor - The base color.
 * @returns {object} An object with 'shade', 'base', and 'tint' color properties.
 */
function getGradientColors(hexColor) {
    if (!hexColor) return { shade: '#000000', base: '#dddddd', tint: '#ffffff' };
    const linear = hexToLinear(hexColor);
    
    // User adjustable factors for gradient
    const SHADE_FACTOR = 0.1; // 10% darker
    const TINT_FACTOR = 0.1;  // 10% brighter

    const shadedLinear = linear.map(c => c * (1 - SHADE_FACTOR));
    const tintedLinear = linear.map(c => c + (1 - c) * TINT_FACTOR);

    return {
        shade: linearToHex(shadedLinear),
        base: hexColor,
        tint: linearToHex(tintedLinear)
    };
}


export { getContrastingTextColor, createShade, createTint, getGradientColors, createReallyDarkShade };
