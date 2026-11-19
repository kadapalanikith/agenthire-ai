import { RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react-native';
import { Button, Screen, Text } from '../../../src/components/ui';
import { SystemStatusCard } from '../../../src/features/system/SystemStatusCard';
import { JobStats } from '../../../src/features/dashboard/JobStats';
import { useAuthStore } from '../../../src/stores/authStore';
import { useTheme } from '../../../src/theme/ThemeProvider';

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const DASHBOARD_QUERIES = [['dashboard'], ['system']];

export default function DashboardOverviewScreen() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ predicate: (q) => DASHBOARD_QUERIES.some((k) => q.queryKey[0] === k[0]) }) > 0;
  const { colors } = useTheme();
  const firstName = user?.name?.split(' ')[0];

  const refresh = () => Promise.all(DASHBOARD_QUERIES.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={fetching} onRefresh={refresh} tintColor={colors.muted} />}>
      <View className="gap-6 pt-6">
        <View className="gap-1">
          <Text variant="label" tone="muted" className="font-normal">
            {greeting()}
          </Text>
          <Text variant="display" testID="dashboard-greeting">
            {firstName ? `Hi, ${firstName}` : 'Dashboard'}
          </Text>
        </View>

        <View className="flex-row gap-2">
          <Button title="Create job" icon={Plus} size="md" className="flex-1" onPress={() => router.push('/dashboard/jobs/create')} testID="quick-create-job" />
          <Button title="Refresh" icon={RefreshCw} variant="secondary" size="md" onPress={refresh} loading={fetching} testID="quick-refresh" />
        </View>

        <JobStats />
        <SystemStatusCard />
      </View>
    </Screen>
  );
}
