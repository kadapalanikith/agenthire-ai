/** Build a fetch Response-like object for the API client. */
export function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

export function mockFetchOnce(status, body) {
  global.fetch.mockResolvedValueOnce(jsonResponse(status, body));
}
