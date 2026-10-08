/** Key used in the query string for visitations without a referrer. */
export const UNKNOWN = 'unknown';

const values = (params, key) => params.getAll(key).flatMap((p) => p.split(',')).filter(Boolean);

/** Returns a query string with `value` added to the `key` exclusion list. */
function addFilter(currentQuery, key, value) {
  const params = new URLSearchParams(currentQuery);
  const current = values(params, key);
  const next = value || UNKNOWN;
  params.delete(key);
  [...new Set([...current, next])].forEach((v) => params.append(key, v));
  return `?${params}`;
}

/** Returns a query string with `value` removed from the `key` exclusion list. */
function removeFilter(currentQuery, key, value) {
  const params = new URLSearchParams(currentQuery);
  const remaining = values(params, key).filter((v) => v !== (value || UNKNOWN));
  params.delete(key);
  remaining.forEach((v) => params.append(key, v));
  const query = params.toString();
  return query ? `?${query}` : '?';
}

/** Normalizes `?key=a,b&key=c` (string or array) into ['a','b','c']. */
function parseFilterParam(param) {
  if (!param) return [];
  return (Array.isArray(param) ? param : [param]).flatMap((p) => String(p).split(',')).filter(Boolean);
}

export { addFilter, removeFilter, parseFilterParam };
