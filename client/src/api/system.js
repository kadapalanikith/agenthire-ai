import { apiRequest } from './client';

export const systemApi = {
  health: () => apiRequest('/health', { timeoutMs: 8000 }),
  authPolicy: () => apiRequest('/meta/auth-policy'),
  workflowSpec: () => apiRequest('/meta/workflow-spec'),
  uploadPolicy: () => apiRequest('/meta/upload-policy'),
};
