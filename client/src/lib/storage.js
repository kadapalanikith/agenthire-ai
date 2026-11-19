import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Key/value persistence.
 * - Native: Expo SecureStore (Keychain / Android Keystore).
 * - Web: sessionStorage for secrets (cleared when the tab closes) and
 *   localStorage for non-sensitive preferences. Web storage can throw in
 *   private mode, so every access is guarded.
 */
const isWeb = Platform.OS === 'web';

function webStore(kind) {
  try {
    return kind === 'secure' ? globalThis.sessionStorage : globalThis.localStorage;
  } catch {
    return null;
  }
}

async function getItem(key, kind) {
  if (isWeb) {
    try {
      return webStore(kind)?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key, value, kind) {
  if (isWeb) {
    try {
      webStore(kind)?.setItem(key, value);
    } catch {
      // Storage unavailable: the session simply will not persist.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

async function removeItem(key, kind) {
  if (isWeb) {
    try {
      webStore(kind)?.removeItem(key);
    } catch {
      // ignore
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

const TOKEN_KEY = 'agenthire.session.token';
const THEME_KEY = 'agenthire.pref.theme';

export const tokenStorage = {
  get: () => getItem(TOKEN_KEY, 'secure'),
  set: (token) => setItem(TOKEN_KEY, token, 'secure'),
  clear: () => removeItem(TOKEN_KEY, 'secure'),
};

export const preferenceStorage = {
  getTheme: () => getItem(THEME_KEY, 'preference'),
  setTheme: (value) => setItem(THEME_KEY, value, 'preference'),
};
