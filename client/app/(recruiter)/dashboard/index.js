import { RefreshControl, View } from 'react-native';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Card, Screen, Text } from '../../../src/components/ui';
import { SystemStatusCard } from '../../../src/features/system/SystemStatusCard';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/theme/ThemeProvider';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardOverviewScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['system'] }) > 0;
  const { colors } = useTheme();
  const firstName = user?.name?.split(' ')[0];

  return (
    <Screen
      edges={['top']}
      refreshControl={
        <RefreshControl
          refreshing={fetching}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ['system'] })}
          tintColor={colors.muted}
        />
      }
    >
      <View className="gap-6 pt-6">
        <View className="gap-1">
          <Text variant="label" tone="muted" className="font-normal">
            {greeting()}
          </Text>
          <Text variant="display" testID="dashboard-greeting">
            {firstName ? `Hi, ${firstName}` : 'Dashboard'}
          </Text>
        </View>

        <SystemStatusCard />

        <Card>
          <Text variant="heading">Your workspace</Text>
          <Text tone="muted" className="mt-1">
            Signed in as {user?.email}. Jobs, candidates and workflows you create will be summarised here.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}
