import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GitBranch, Search } from 'lucide-react-native';
import { Chip, EmptyState, ErrorState, Text } from '../../../../src/components/ui';
import { WorkflowCard, WorkflowCardSkeleton } from '../../../../src/features/workflows/components/WorkflowCard';
import { useWorkflowSpec, useWorkflows } from '../../../../src/features/workflows/hooks';
import { useTheme } from '../../../../src/theme/ThemeProvider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'waiting_approval', label: 'Needs decision' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Queued' },
];

export default function WorkflowsListScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const initial = FILTERS.some((f) => f.value === params.status) ? params.status : 'all';
  const [status, setStatus] = useState(initial);
  const spec = useWorkflowSpec();
  const list = useWorkflows({ status: status === 'all' ? undefined : status });

  const header = (
    <View className="gap-4 pb-4 pt-6">
      <View className="gap-0.5">
        <Text variant="display">Workflows</Text>
        {list.data ? (
          <Text variant="label" tone="muted" className="font-normal" testID="workflows-total">
            {list.data.total} {list.data.total === 1 ? 'workflow' : 'workflows'}
          </Text>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} testID={`workflow-filter-${f.value}`} />
        ))}
      </ScrollView>
    </View>
  );

  let body = null;
  if (list.isPending) {
    body = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <WorkflowCardSkeleton key={i} />
        ))}
      </View>
    );
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={list.refetch} retrying={list.isFetching} />;
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        testID="workflows-list"
        data={list.data?.workflows || []}
        keyExtractor={(w) => w.id}
        renderItem={({ item }) => <WorkflowCard workflow={item} spec={spec.data} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <>
            {header}
            {body}
          </>
        }
        ListEmptyComponent={
          list.isSuccess ? (
            status !== 'all' ? (
              <EmptyState icon={Search} title="Nothing here" description="No workflows match this filter." />
            ) : (
              <EmptyState icon={GitBranch} title="No workflows yet" description="A workflow starts automatically when a candidate applies." />
            )
          ) : null
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.muted} /> : <View className="h-8" />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={list.refetch} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingHorizontal: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}
      />
    </SafeAreaView>
  );
}
