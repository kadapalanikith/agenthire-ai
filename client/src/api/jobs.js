import { apiRequest } from './client';

export const jobsApi = {
  /** Resolves { data: { jobs }, meta: { page, limit, total, total_pages } }. */
  list: ({ scope = 'public', status, q, page = 1, limit = 20 } = {}) =>
    apiRequest('/jobs', { query: { scope, status, q, page, limit }, auth: scope === 'mine', withMeta: true }),
  /** Sends the token when signed in so owners receive the full record. */
  get: (id) => apiRequest(`/jobs/${encodeURIComponent(id)}`, { auth: true }),
  /** Anonymous fetch for public candidate pages (never sends the recruiter token). */
  getPublic: (id) => apiRequest(`/jobs/${encodeURIComponent(id)}`),
  create: (body) => apiRequest('/jobs', { method: 'POST', body, auth: true }),
  update: (id, body) => apiRequest(`/jobs/${encodeURIComponent(id)}`, { method: 'PUT', body, auth: true }),
};
