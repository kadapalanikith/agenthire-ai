import { apiRequest, getApiBaseUrl } from './client';

const UPLOAD_TIMEOUT_MS = 90 * 1000;

export const candidatesApi = {
  /** Public multipart application. `formData` must contain job_id, name, email, phone and resume. */
  apply: (formData) => apiRequest('/candidates/upload', { method: 'POST', body: formData, timeoutMs: UPLOAD_TIMEOUT_MS }),
  /** Public status lookup by the token returned at submission. */
  status: (statusToken) => apiRequest(`/candidates/status/${encodeURIComponent(statusToken)}`),

  list: ({ job_id: jobId, status, q, page = 1, limit = 20 } = {}) =>
    apiRequest('/candidates', { query: { job_id: jobId, status, q, page, limit }, auth: true, withMeta: true }),
  get: (id) => apiRequest(`/candidates/${encodeURIComponent(id)}`, { auth: true }),
  /** Resolves an absolute, short-lived URL for opening the resume PDF. */
  resumeUrl: async (id) => {
    const { path, expires_at: expiresAt } = await apiRequest(`/candidates/${encodeURIComponent(id)}/resume-link`, { auth: true });
    return { url: `${getApiBaseUrl()}${path}`, expiresAt };
  },
};
