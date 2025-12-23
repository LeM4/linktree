export function getCountry(request) {
  return request.headers['cf-ipcountry'] || 'US';
}
