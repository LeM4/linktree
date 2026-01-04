const socialMediaMappings = [
    { keywords: ['musical_ly', 'Bytedance', 'tiktok'], referrer: 'https://tiktok.com/' },
    // Add more mappings here, e.g.:
    // { keywords: ['instagram'], referrer: 'https://instagram.com/' },
    // { keywords: ['facebook'], referrer: 'https://facebook.com/' },
];

/**
 * Infers a referrer from the User-Agent string if the current referrer is unknown.
 * @param {string} userAgent - The User-Agent header from the request.
 * @param {string} currentReferrer - The current referrer from the request.
 * @returns {string} The inferred referrer, or the original referrer if no match is found.
 */
function inferReferrerFromUserAgent(userAgent, currentReferrer) {
    if (currentReferrer) {
        return currentReferrer;
    }

    if (!userAgent) {
        return currentReferrer;
    }

    for (const mapping of socialMediaMappings) {
        for (const keyword of mapping.keywords) {
            if (userAgent.toLowerCase().includes(keyword.toLowerCase())) {
                return mapping.referrer;
            }
        }
    }

    return currentReferrer;
}

export { inferReferrerFromUserAgent };
