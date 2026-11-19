import { ApiError, apiRequest, applyFieldErrors, configureApiClient } from '../../src/api/client';
import { mockFetchOnce } from '../helpers/fetch';

describe('apiRequest', () => {
  let onUnauthorized;

  beforeEach(() => {
    global.fetch = jest.fn();
    onUnauthorized = jest.fn();
    configureApiClient({ baseUrl: 'http://api.test', getToken: () => 'jwt-token', onUnauthorized });
  });

  test('unwraps the success envelope', async () => {
    mockFetchOnce(200, { success: true, data: { ok: 1 } });
    await expect(apiRequest('/health')).resolves.toEqual({ ok: 1 });
    expect(global.fetch).toHaveBeenCalledWith('http://api.test/health', expect.objectContaining({ method: 'GET' }));
  });

  test('returns meta when requested and serialises query params', async () => {
    mockFetchOnce(200, { success: true, data: [1], meta: { page: 2 } });
    const out = await apiRequest('/jobs', { query: { page: 2, empty: '', none: undefined }, withMeta: true });
    expect(out).toEqual({ data: [1], meta: { page: 2 } });
    expect(global.fetch.mock.calls[0][0]).toBe('http://api.test/jobs?page=2');
  });

  test('attaches the bearer token only for authenticated requests', async () => {
    mockFetchOnce(200, { success: true, data: {} });
    mockFetchOnce(200, { success: true, data: {} });
    await apiRequest('/auth/me', { auth: true });
    await apiRequest('/auth/login', { method: 'POST', body: { a: 1 } });
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-token');
    expect(global.fetch.mock.calls[1][1].headers.Authorization).toBeUndefined();
    expect(global.fetch.mock.calls[1][1].body).toBe('{"a":1}');
    expect(global.fetch.mock.calls[1][1].headers['Content-Type']).toBe('application/json');
  });

  test('throws ApiError with server code, message and details', async () => {
    mockFetchOnce(400, {
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: [{ path: 'email', message: 'bad' }] },
    });
    const err = await apiRequest('/auth/login', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', message: 'Request validation failed' });
    expect(err.details).toHaveLength(1);
  });

  test('notifies the session on 401 for authenticated requests only', async () => {
    mockFetchOnce(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'nope' } });
    await expect(apiRequest('/auth/me', { auth: true })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    mockFetchOnce(401, { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'wrong' } });
    await expect(apiRequest('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  test('reports network failures instead of fabricating data', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    const err = await apiRequest('/health').catch((e) => e);
    expect(err).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(err.isNetworkError).toBe(true);
  });

  test('times out slow requests', async () => {
    global.fetch.mockImplementationOnce(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    await expect(apiRequest('/health', { timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  test('treats non-envelope responses as errors', async () => {
    global.fetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => '<html>' });
    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  test('fails clearly when the API URL is not configured', async () => {
    configureApiClient({ baseUrl: undefined });
    await expect(apiRequest('/health')).rejects.toMatchObject({ code: 'CONFIG_ERROR' });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('applyFieldErrors', () => {
  test('maps validation details to form fields', () => {
    const setError = jest.fn();
    const err = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'x',
      details: [
        { path: 'email', message: 'Invalid' },
        { path: 'unknown', message: 'ignored' },
      ],
    });
    expect(applyFieldErrors(err, setError, ['email'])).toBe(true);
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'Invalid' });
    expect(setError).toHaveBeenCalledTimes(1);
  });

  test('ignores non-validation errors', () => {
    const setError = jest.fn();
    expect(applyFieldErrors(new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'x' }), setError, ['email'])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
