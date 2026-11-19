import '../global.css';
import '../src/lib/nativewindInterop';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { useAuthStore } from '../src/stores/authStore';
import { SessionGate } from '../src/features/auth/SessionGate';
import { ApiError } from '../src/api/client';

SplashScreen.preventAutoHideAsync().catch(() => {});

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        // Do not retry client errors (4xx); retry transient failures twice.
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
      },
    },
  });
}

function RootNavigator() {
  const { scheme, colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const isAuthenticated = status === 'authenticated';

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <SessionGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          <Stack.Protected guard={isAuthenticated}>
            <Stack.Screen name="(recruiter)" />
          </Stack.Protected>
          <Stack.Protected guard={!isAuthenticated}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
          {/* Public routes: reachable with or without a session. */}
          <Stack.Screen name="index" />
          <Stack.Screen name="reset-password" />
        </Stack>
      </SessionGate>
    </>
  );
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    restore();
  }, [restore]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <RootNavigator />
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
