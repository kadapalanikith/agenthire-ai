import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Button, ErrorState, LogoMark, Text } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../theme/ThemeProvider';

/**
 * Holds navigation until the stored session has been verified with the
 * server, so protected routes never render on unverified state.
 */
export function SessionGate({ children }) {
  const { colors } = useTheme();
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const restore = useAuthStore((s) => s.restore);
  const signOut = useAuthStore((s) => s.signOut);
  const settled = status !== 'idle' && status !== 'restoring';

  useEffect(() => {
    if (settled) SplashScreen.hideAsync().catch(() => {});
  }, [settled]);

  if (status === 'error') {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6" testID="session-error">
        <ErrorState error={error} title="Couldn't verify your session" onRetry={restore} />
        <Button title="Sign out" variant="ghost" size="md" onPress={signOut} />
      </View>
    );
  }

  if (!settled) {
    return (
      <View className="flex-1 items-center justify-center gap-5 bg-background" testID="splash">
        <LogoMark size={56} />
        <View className="items-center gap-1">
          <Text variant="heading">AgentHire</Text>
          <Text variant="label" tone="muted" className="font-normal">
            AI recruitment workflows
          </Text>
        </View>
        <ActivityIndicator color={colors.muted} />
      </View>
    );
  }

  return children;
}
