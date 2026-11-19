/**
 * Centralised REST client for the AgentHire API.
 *
 * - Reads the base URL from EXPO_PUBLIC_API_URL (no secrets live in the app).
 * - Attaches the recruiter JWT when `auth` is true.
 * - Unwraps the server envelope { success, data, meta } and throws ApiError
 *   for every failure. It never fabricates a response.
 */

export class ApiError extends Error {
  constructor({ status = 0, code, message, details }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isNetworkError() {
    return this.code === 'NETWORK_ERROR' || this.code === 'TIMEOUT';
  }
}

const DEFAULT_TIMEOUT_MS = 15000;

const config = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL,
  getToken: () => null,
  onUnauthorized: () => {},
};

/** Wire the client to the auth store (avoids an import cycle). */
export function configureApiClient(options) {
  Object.assign(config, options);
}

export function getApiBaseUrl() {
  return config.baseUrl ? config.baseUrl.replace(/\/+$/, '') : null;
}

function buildUrl(path, query) {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError({
      code: 'CONFIG_ERROR',
      message: 'The app is not configured with an API URL (EXPO_PUBLIC_API_URL).',
    });
  }
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * @param {string} path  e.g. '/auth/login'
 * @param {object} [options]
 * @param {string} [options.method]
 * @param {object|FormData} [options.body]
 * @param {object} [options.query]
 * @param {boolean} [options.auth]  attach the recruiter token
 * @param {number} [options.timeoutMs]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.withMeta]  resolve { data, meta } instead of data
 */
export async function apiRequest(path, options = {}) {
  const { method = 'GET', body, query, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS, signal, withMeta = false } = options;
  const url = buildUrl(path, query);

  const headers = { Accept: 'application/json' };
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = await config.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener?.('abort', abortFromCaller);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (timedOut) throw new ApiError({ code: 'TIMEOUT', message: 'The server took too long to respond. Please try again.' });
    if (signal?.aborted) throw err;
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'Unable to reach the AgentHire server. Check your connection.' });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.('abort', abortFromCaller);
  }

  const payload = await parseBody(response);

  if (!response.ok || !payload || payload.success !== true) {
    const error = payload?.error;
    const apiError = new ApiError({
      status: response.status,
      code: error?.code || (response.ok ? 'INVALID_RESPONSE' : 'HTTP_ERROR'),
      message: error?.message || `Request failed (${response.status})`,
      details: error?.details,
    });
    if (auth && response.status === 401) config.onUnauthorized(apiError);
    throw apiError;
  }

  return withMeta ? { data: payload.data, meta: payload.meta } : payload.data;
}

/** Map server VALIDATION_ERROR details onto react-hook-form fields. Returns true if any field was set. */
export function applyFieldErrors(error, setError, fields) {
  if (!(error instanceof ApiError) || error.code !== 'VALIDATION_ERROR' || !Array.isArray(error.details)) return false;
  let applied = false;
  for (const detail of error.details) {
    if (fields.includes(detail.path)) {
      setError(detail.path, { type: 'server', message: detail.message });
      applied = true;
    }
  }
  return applied;
}
