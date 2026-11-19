import { apiRequest } from './client';

export const dashboardApi = {
  summary: () => apiRequest('/dashboard/summary', { auth: true }),
  hiringSpecs: () => apiRequest('/meta/hiring-specs', { auth: true }),
};
