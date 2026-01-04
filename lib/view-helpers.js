/**
 * Adds a filter to the current URL query string.
 * @param {object} currentQuery - The current query parameters from the request.
 * @param {string} key - The filter key to add.
 * @param {string} value - The filter value to add.
 * @returns {string} The new query string.
 */
function addFilter(currentQuery, key, value) {
  const params = new URLSearchParams(currentQuery);
  params.append(key, value);
  return '?' + params.toString();
}

/**
 * Removes a filter from the current URL query string.
 * @param {object} currentQuery - The current query parameters from the request.
 * @param {string} key - The filter key to remove.
 * @param {string} value - The filter value to remove.
 * @returns {string} The new query string.
 */
function removeFilter(currentQuery, key, value) {
    const params = new URLSearchParams(currentQuery);
    const allParams = params.getAll(key).flatMap(p => p.split(',')); // Split comma-separated values
    params.delete(key);
    allParams.filter(p => p !== (value || 'unknown')).forEach(p => params.append(key, p));
    return '?' + params.toString();
}

export { addFilter, removeFilter };
