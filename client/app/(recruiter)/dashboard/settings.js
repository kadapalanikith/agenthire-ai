import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Constants from 'expo-constants';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react-native';
import { Badge, Button, Card, Screen, Text } from '../../../src/components/ui';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeStore } from '../../../src/stores/themeStore';
import { useSignOut } from '../../../src/features/auth/hooks';
import { useTheme } from '../../../src/theme/ThemeProvider';
import { cn } from '../../../src/lib/cn';

const THEME_OPTIONS = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function ThemeSelector() {
  const { colors } = useTheme();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);
  return (
    <View className="flex-row gap-1 rounded-xl bg-surface-muted p-1" accessibilityRole="radiogroup">
      {THEME_OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <Pressable
            key={value}
            testID={`theme-${value}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            onPress={() => setPreference(value)}
            className={cn('h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-lg', active && 'border border-border bg-surface')}
          >
            <Icon size={15} color={active ? colors.foreground : colors.muted} />
            <Text variant="label" tone={active ? 'default' : 'muted'}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useSignOut();
  // Native confirm dialogs are unavailable on web, so confirmation is inline.
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen edges={['top']}>
      <View className="gap-6 pt-6">
        <Text variant="display">Settings</Text>

        <Card className="flex-row items-center gap-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-primary-muted">
            <Text variant="heading" tone="primary">
              {initials(user?.name)}
            </Text>
          </View>
          <View className="flex-1 gap-1">
            <Text variant="heading" testID="profile-name">
              {user?.name}
            </Text>
            <Text variant="label" tone="muted" className="font-normal" testID="profile-email">
              {user?.email}
            </Text>
            <Badge label={user?.role === 'admin' ? 'Admin' : 'Recruiter'} tone="primary" dot={false} />
          </View>
        </Card>

        <View className="gap-2">
          <Text variant="label" tone="muted">
            Appearance
          </Text>
          <ThemeSelector />
        </View>

        <View className="gap-2">
          <Text variant="label" tone="muted">
            Account
          </Text>
          {confirming ? (
            <Card className="gap-3">
              <Text>Sign out of AgentHire on this device?</Text>
              <View className="flex-row gap-2">
                <Button title="Cancel" variant="secondary" size="md" className="flex-1" onPress={() => setConfirming(false)} />
                <Button title="Sign out" variant="danger" size="md" className="flex-1" onPress={signOut} testID="confirm-sign-out" />
              </View>
            </Card>
          ) : (
            <Button title="Sign out" variant="secondary" icon={LogOut} onPress={() => setConfirming(true)} testID="sign-out" />
          )}
        </View>

        <Text variant="caption" tone="subtle" className="text-center">
          AgentHire {Constants.expoConfig?.version ?? ''}
        </Text>
      </View>
    </Screen>
  );
}
