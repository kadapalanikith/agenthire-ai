import { jsonResponse } from './fetch';

/**
 * Route fetch calls by "METHOD /path" (query string ignored) to handlers that
 * return [status, body]. Unmatched requests fail loudly.
 */
export function mockApi(routes) {
  global.fetch = jest.fn(async (url, init = {}) => {
    const { pathname } = new URL(url);
    const key = `${init.method || 'GET'} ${pathname}`;
    const handler = routes[key];
    if (!handler) throw new Error(`Unexpected request: ${key}`);
    const [status, body] = typeof handler === 'function' ? handler(url, init) : handler;
    return jsonResponse(status, body);
  });
  return global.fetch;
}

export function callsTo(key) {
  return global.fetch.mock.calls.filter(([url, init = {}]) => `${init.method || 'GET'} ${new URL(url).pathname}` === key);
}
