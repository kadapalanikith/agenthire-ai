import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Briefcase, Plus, Search } from 'lucide-react-native';
import { Button, EmptyState, ErrorState, SegmentedControl, Text, TextField } from '../../../../src/components/ui';
import { JobCard, JobCardSkeleton } from '../../../../src/features/jobs/components/JobCard';
import { useMyJobs } from '../../../../src/features/jobs/hooks';
import { useDebouncedValue } from '../../../../src/lib/useDebouncedValue';
import { useTheme } from '../../../../src/theme/ThemeProvider';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

export default function JobsListScreen() {
  const { colors } = useTheme();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const jobs = useMyJobs({ status: filter === 'all' ? undefined : filter, q });

  const header = (
    <View className="gap-4 pb-4 pt-6">
      <View className="flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text variant="display">Jobs</Text>
          {jobs.data ? (
            <Text variant="label" tone="muted" className="font-normal" testID="jobs-total">
              {jobs.data.total} {jobs.data.total === 1 ? 'job' : 'jobs'}
            </Text>
          ) : null}
        </View>
        <Button title="New job" icon={Plus} size="md" onPress={() => router.push('/dashboard/jobs/create')} testID="new-job" />
      </View>
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search by title"
        autoCapitalize="none"
        returnKeyType="search"
        right={<Search size={16} color={colors.subtle} />}
        testID="jobs-search"
      />
      <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} testID="jobs-filter" />
    </View>
  );

  let body = null;
  if (jobs.isPending) {
    body = (
      <View className="gap-3">
        {[0, 1, 2].map((i) => (
          <JobCardSkeleton key={i} />
        ))}
      </View>
    );
  } else if (jobs.isError) {
    body = <ErrorState error={jobs.error} onRetry={jobs.refetch} retrying={jobs.isFetching} />;
  }

  const isFiltered = filter !== 'all' || q;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        testID="jobs-list"
        data={jobs.data?.jobs || []}
        keyExtractor={(j) => j.id}
        renderItem={({ item }) => <JobCard job={item} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <>
            {header}
            {body}
          </>
        }
        ListEmptyComponent={
          jobs.isSuccess ? (
            isFiltered ? (
              <EmptyState icon={Search} title="No matching jobs" description="Try a different search or filter." />
            ) : (
              <EmptyState
                icon={Briefcase}
                title="Create your first job"
                description="Publish a role, share its apply link, and AgentHire will screen every applicant for you."
                action={<Button title="Create job" size="md" icon={Plus} onPress={() => router.push('/dashboard/jobs/create')} />}
              />
            )
          ) : null
        }
        ListFooterComponent={
          jobs.isFetchingNextPage ? <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.muted} /> : <View className="h-8" />
        }
        onEndReached={() => jobs.hasNextPage && !jobs.isFetchingNextPage && jobs.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={jobs.isRefetching && !jobs.isFetchingNextPage} onRefresh={jobs.refetch} tintColor={colors.muted} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}
