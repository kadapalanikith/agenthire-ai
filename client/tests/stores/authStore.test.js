import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/stores/authStore';
import { apiRequest, configureApiClient } from '../../src/api/client';
import { mockFetchOnce } from '../helpers/fetch';

const TOKEN_KEY = 'agenthire.session.token';
const user = { id: 'a'.repeat(24), name: 'Riley Morgan', email: 'r@example.com', role: 'recruiter' };

function reset() {
  SecureStore.__store.clear();
  useAuthStore.setState({ status: 'idle', user: null, token: null, error: null });
}

describe('auth store', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    configureApiClient({ baseUrl: 'http://api.test' });
    reset();
  });

  test('restores to unauthenticated when no token is stored', async () => {
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('verifies a stored token with GET /auth/me', async () => {
    SecureStore.__store.set(TOKEN_KEY, 'stored-jwt');
    mockFetchOnce(200, { success: true, data: { user } });
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', user, token: 'stored-jwt' });
    expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer stored-jwt');
  });

  test('clears a token the server rejects', async () => {
    SecureStore.__store.set(TOKEN_KEY, 'revoked-jwt');
    mockFetchOnce(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: 'expired' } });
    await useAuthStore.getState().restore();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(SecureStore.__store.has(TOKEN_KEY)).toBe(false);
  });

  test('keeps the token but reports an error when the server is unreachable', async () => {
    SecureStore.__store.set(TOKEN_KEY, 'stored-jwt');
    global.fetch.mockRejectedValueOnce(new TypeError('Network request failed'));
    await useAuthStore.getState().restore();
    const state = useAuthStore.getState();
    expect(state.status).toBe('error');
    expect(state.user).toBeNull();
    expect(state.error.code).toBe('NETWORK_ERROR');
    expect(SecureStore.__store.get(TOKEN_KEY)).toBe('stored-jwt');
  });

  test('signIn persists the token securely and signOut removes it', async () => {
    await useAuthStore.getState().signIn({ token: 'new-jwt', user });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'new-jwt', expect.any(Object));
    expect(useAuthStore.getState().status).toBe('authenticated');
    await useAuthStore.getState().signOut();
    expect(SecureStore.__store.has(TOKEN_KEY)).toBe(false);
    expect(useAuthStore.getState()).toMatchObject({ status: 'unauthenticated', user: null, token: null });
  });

  test('a 401 on an authenticated request signs the user out', async () => {
    await useAuthStore.getState().signIn({ token: 'jwt', user });
    mockFetchOnce(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'gone' } });
    await expect(apiRequest('/auth/me', { auth: true })).rejects.toMatchObject({ status: 401 });
    await Promise.resolve();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
