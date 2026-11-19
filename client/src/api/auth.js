import { apiRequest } from './client';

export const authApi = {
  signup: (body) => apiRequest('/auth/signup', { method: 'POST', body }),
  login: (body) => apiRequest('/auth/login', { method: 'POST', body }),
  me: () => apiRequest('/auth/me', { auth: true }),
  forgotPassword: (body) => apiRequest('/auth/forgot-password', { method: 'POST', body }),
  resetPassword: (body) => apiRequest('/auth/reset-password', { method: 'POST', body }),
};
