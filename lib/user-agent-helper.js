const socialMediaMappings = [
  { keywords: ['musical_ly', 'bytedance', 'tiktok'], referrer: 'https://tiktok.com/' },
  { keywords: ['instagram'], referrer: 'https://instagram.com/' },
  { keywords: ['fban', 'fbav', 'fb_iab'], referrer: 'https://facebook.com/' },
  { keywords: ['snapchat'], referrer: 'https://snapchat.com/' },
  { keywords: ['twitter'], referrer: 'https://x.com/' },
];

/**
 * In-app browsers usually send no referrer; infer it from the User-Agent instead.
 * @returns {string} The given referrer, an inferred one, or ''.
 */
function inferReferrerFromUserAgent(userAgent, currentReferrer) {
  if (currentReferrer) return currentReferrer;
  const ua = (userAgent || '').toLowerCase();
  if (!ua) return '';
  const match = socialMediaMappings.find((m) => m.keywords.some((k) => ua.includes(k)));
  return match ? match.referrer : '';
}

export { inferReferrerFromUserAgent };
