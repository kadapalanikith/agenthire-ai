import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users } from 'lucide-react-native';
import { Chip, EmptyState, ErrorState, Text, TextField } from '../../../../src/components/ui';
import { CandidateCard, CandidateCardSkeleton } from '../../../../src/features/candidates/components/CandidateCard';
import { useCandidates } from '../../../../src/features/candidates/hooks';
import { CANDIDATE_FILTERS } from '../../../../src/features/candidates/status';
import { useJob } from '../../../../src/features/jobs/hooks';
import { useDebouncedValue } from '../../../../src/lib/useDebouncedValue';
import { useTheme } from '../../../../src/theme/ThemeProvider';

export default function CandidatesListScreen() {
  const { colors } = useTheme();
  const { jobId } = useLocalSearchParams();
  const jobFilter = typeof jobId === 'string' && jobId ? jobId : undefined;
  const job = useJob(jobFilter);
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const list = useCandidates({ jobId: jobFilter, status: status === 'all' ? undefined : status, q });

  const header = (
    <View className="gap-4 pb-4 pt-6">
      <View className="gap-0.5">
        <Text variant="display">Candidates</Text>
        {list.data ? (
          <Text variant="label" tone="muted" className="font-normal" testID="candidates-total">
            {list.data.total} {list.data.total === 1 ? 'candidate' : 'candidates'}
          </Text>
        ) : null}
      </View>
      {jobFilter ? (
        <View className="flex-row items-center gap-2">
          <Text variant="label" tone="muted" className="font-normal">
            Job:
          </Text>
          <Chip
            label={job.data?.job?.title || 'Loading…'}
            selected
            onRemove={() => router.setParams({ jobId: '' })}
            testID="job-filter-chip"
          />
        </View>
      ) : null}
      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Search name or email"
        autoCapitalize="none"
        returnKeyType="search"
        right={<Search size={16} color={colors.subtle} />}
        testID="candidates-search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {CANDIDATE_FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={status === f.value} onPress={() => setStatus(f.value)} testID={`candidate-filter-${f.value}`} />
        ))}
      </ScrollView>
    </View>
  );

  let body = null;
  if (list.isPending) {
    body = (
      <View className="gap-3">
        {[0, 1, 2, 3].map((i) => (
          <CandidateCardSkeleton key={i} />
        ))}
      </View>
    );
  } else if (list.isError) {
    body = <ErrorState error={list.error} onRetry={list.refetch} retrying={list.isFetching} />;
  }

  const filtered = status !== 'all' || q || jobFilter;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <FlatList
        testID="candidates-list"
        data={list.data?.candidates || []}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => <CandidateCard candidate={item} showJob={!jobFilter} />}
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <>
            {header}
            {body}
          </>
        }
        ListEmptyComponent={
          list.isSuccess ? (
            filtered ? (
              <EmptyState icon={Search} title="No matching candidates" description="Try a different search or filter." />
            ) : (
              <EmptyState
                icon={Users}
                title="No candidates yet"
                description="Share a job's apply link. Applications appear here as soon as candidates submit them."
              />
            )
          ) : null
        }
        ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator style={{ paddingVertical: 16 }} color={colors.muted} /> : <View className="h-8" />}
        onEndReached={() => list.hasNextPage && !list.isFetchingNextPage && list.fetchNextPage()}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={list.refetch} tintColor={colors.muted} />}
        contentContainerStyle={{ paddingHorizontal: 20, maxWidth: 600, width: '100%', alignSelf: 'center' }}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}
