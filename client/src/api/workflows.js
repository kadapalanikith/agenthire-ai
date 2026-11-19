import { apiRequest } from './client';

export const workflowsApi = {
  list: ({ status, job_id: jobId, page = 1, limit = 20 } = {}) =>
    apiRequest('/workflow', { query: { status, job_id: jobId, page, limit }, auth: true, withMeta: true }),
  get: (id) => apiRequest(`/workflow/${encodeURIComponent(id)}`, { auth: true }),
  approve: ({ workflowId, decision, reason }) =>
    apiRequest('/workflow/approve', { method: 'POST', body: { workflow_id: workflowId, decision, ...(reason ? { reason } : {}) }, auth: true }),
  retry: (workflowId) => apiRequest('/workflow/retry', { method: 'POST', body: { workflow_id: workflowId }, auth: true }),
};
