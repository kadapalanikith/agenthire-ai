import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronRight, Plus } from 'lucide-react-native';
import { Button, Card, CardHeader, EmptyState, ErrorState, Skeleton, Text } from '../../components/ui';
import { JobStatusBadge } from '../jobs/components/JobStatusBadge';
import { useDashboardSummary } from '../jobs/hooks';
import { formatDate } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';

function Stat({ label, value, testID }) {
  return (
    <View className="flex-1 rounded-2xl border border-border bg-surface p-4" testID={testID}>
      <Text variant="caption" tone="muted" className="font-semibold uppercase tracking-wide">
        {label}
      </Text>
      <Text variant="display" className="mt-1">
        {value}
      </Text>
    </View>
  );
}

/** Job counts and recent jobs from GET /dashboard/summary. */
export function JobStats() {
  const { colors } = useTheme();
  const summary = useDashboardSummary();

  if (summary.isPending) {
    return (
      <View className="gap-4" testID="job-stats-loading">
        {[0, 1].map((row) => (
          <View key={row} className="flex-row gap-3">
            <Skeleton className="h-[88px] flex-1 rounded-2xl" />
            <Skeleton className="h-[88px] flex-1 rounded-2xl" />
          </View>
        ))}
        <Skeleton className="h-40 w-full rounded-2xl" />
      </View>
    );
  }

  if (summary.isError) {
    return (
      <Card>
        <ErrorState error={summary.error} onRetry={summary.refetch} retrying={summary.isFetching} />
      </Card>
    );
  }

  const { jobs, candidates, workflows, recent_jobs: recent } = summary.data;
  const completion = workflows.completion_rate === null ? '—' : `${workflows.completion_rate}%`;

  return (
    <View className="gap-4">
      <View className="gap-3">
        <View className="flex-row gap-3">
          <Stat label="Open jobs" value={jobs.open} testID="stat-open" />
          <Stat label="Candidates" value={candidates.total} testID="stat-candidates" />
        </View>
        <View className="flex-row gap-3">
          <Stat label="Workflows" value={workflows.total} testID="stat-workflows" />
          <Stat label="Completed" value={completion} testID="stat-completion" />
        </View>
      </View>
      {candidates.by_status.awaiting_review > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/dashboard/candidates')}
          className="flex-row items-center justify-between rounded-2xl border border-warning/30 bg-warning-muted p-4"
          testID="needs-review-banner"
        >
          <Text tone="warning" className="font-semibold">
            {candidates.by_status.awaiting_review} {candidates.by_status.awaiting_review === 1 ? 'candidate needs' : 'candidates need'} your review
          </Text>
          <ChevronRight size={16} color={colors.warning} />
        </Pressable>
      ) : null}

      <Card>
        <CardHeader
          title="Recent jobs"
          right={
            jobs.total > 0 ? (
              <Button title="View all" variant="ghost" size="sm" onPress={() => router.push('/dashboard/jobs')} />
            ) : null
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            title="No jobs yet"
            description="Create a job to get a shareable apply link."
            action={<Button title="Create job" icon={Plus} size="md" onPress={() => router.push('/dashboard/jobs/create')} testID="dashboard-create-job" />}
          />
        ) : (
          recent.map((job, i) => (
            <Pressable
              key={job.id}
              testID={`recent-job-${job.id}`}
              accessibilityRole="button"
              onPress={() => router.push(`/dashboard/jobs/${job.id}`)}
              className={`flex-row items-center gap-3 py-3 ${i === recent.length - 1 ? '' : 'border-b border-border'}`}
            >
              <View className="flex-1 gap-0.5">
                <Text numberOfLines={1} className="font-medium">
                  {job.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDate(job.created_at)}
                </Text>
              </View>
              <JobStatusBadge status={job.status} />
              <ChevronRight size={16} color={colors.subtle} />
            </Pressable>
          ))
        )}
      </Card>
    </View>
  );
}
