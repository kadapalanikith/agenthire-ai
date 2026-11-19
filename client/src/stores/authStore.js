import { create } from 'zustand';
import { authApi } from '../api/auth';
import { ApiError, configureApiClient } from '../api/client';
import { tokenStorage } from '../lib/storage';

/**
 * Session state.
 * status: 'idle' → 'restoring' → 'authenticated' | 'unauthenticated' | 'error'
 * 'error' means a stored session exists but the server could not be reached
 * to verify it; the UI offers retry or sign out (never a fake session).
 */
export const useAuthStore = create((set, get) => ({
  status: 'idle',
  user: null,
  token: null,
  error: null,

  restore: async () => {
    if (get().status === 'restoring') return;
    set({ status: 'restoring', error: null });
    const token = await tokenStorage.get().catch(() => null);
    if (!token) {
      set({ status: 'unauthenticated', token: null, user: null });
      return;
    }
    set({ token });
    try {
      const { user } = await authApi.me();
      set({ status: 'authenticated', user });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await tokenStorage.clear().catch(() => {});
        set({ status: 'unauthenticated', token: null, user: null });
      } else {
        set({ status: 'error', error: err });
      }
    }
  },

  signIn: async ({ token, user }) => {
    await tokenStorage.set(token);
    set({ status: 'authenticated', token, user, error: null });
  },

  setUser: (user) => set({ user }),

  signOut: async () => {
    await tokenStorage.clear().catch(() => {});
    set({ status: 'unauthenticated', token: null, user: null, error: null });
  },
}));

configureApiClient({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    if (useAuthStore.getState().status === 'authenticated') useAuthStore.getState().signOut();
  },
});
