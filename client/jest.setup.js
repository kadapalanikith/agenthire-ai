/* Test-only environment. */
process.env.EXPO_PUBLIC_API_URL = 'http://api.test';

// In-memory SecureStore so storage logic runs without native modules.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    getItemAsync: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => {
      store.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k) => {
      store.delete(k);
    }),
    __store: store,
  };
});

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// Reanimated 4's bundled Jest mock fails under jest-expo 58 ("setCSSEventHandler is
// not available in JSReanimated"), so tests use a minimal double covering only the
// APIs the app uses (Skeleton pulse). Animations are not under test here.
jest.mock('react-native-worklets', () => require('react-native-worklets/lib/module/mock'));
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  const identity = (v) => v;
  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value) => ({ value }),
    useAnimatedStyle: () => ({}),
    withRepeat: identity,
    withTiming: identity,
    Easing: { inOut: () => identity, ease: identity },
  };
});
