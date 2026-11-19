import { create } from 'zustand';
import { preferenceStorage } from '../lib/storage';

export const THEME_PREFERENCES = ['system', 'light', 'dark'];

export const useThemeStore = create((set) => ({
  preference: 'system',
  hydrated: false,

  hydrate: async () => {
    const stored = await preferenceStorage.getTheme().catch(() => null);
    set({ preference: THEME_PREFERENCES.includes(stored) ? stored : 'system', hydrated: true });
  },

  setPreference: async (preference) => {
    if (!THEME_PREFERENCES.includes(preference)) return;
    set({ preference });
    await preferenceStorage.setTheme(preference).catch(() => {});
  },
}));
