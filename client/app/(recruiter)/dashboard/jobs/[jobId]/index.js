import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ExternalLink, Pencil, Users } from 'lucide-react-native';
import {
  Button,
  Card,
  CardHeader,
  ChipList,
  ErrorState,
  InlineAlert,
  Screen,
  ScreenHeader,
  Skeleton,
  Text,
} from '../../../../../src/components/ui';
import { JobStatusBadge } from '../../../../../src/features/jobs/components/JobStatusBadge';
import { ShareLinkCard } from '../../../../../src/features/jobs/components/ShareLinkCard';
import { useJob, useUpdateJob } from '../../../../../src/features/jobs/hooks';
import { formatDate, formatExperience } from '../../../../../src/lib/format';
import { useTheme } from '../../../../../src/theme/ThemeProvider';

function DetailRow({ label, value, last }) {
  return (
    <View className={`flex-row justify-between gap-4 py-2.5 ${last ? '' : 'border-b border-border'}`}>
      <Text tone="muted">{label}</Text>
      <Text className="flex-1 text-right">{value}</Text>
    </View>
  );
}

function StatusAction({ job }) {
  const update = useUpdateJob(job.id);
  const [confirming, setConfirming] = useState(false);
  const closing = job.status === 'open';

  if (!confirming) {
    return (
      <Button
        title={closing ? 'Close job' : 'Reopen job'}
        variant={closing ? 'danger' : 'secondary'}
        onPress={() => setConfirming(true)}
        testID="toggle-status"
      />
    );
  }
  return (
    <Card className="gap-3">
      <Text>
        {closing
          ? 'Close this job? The apply link will stop accepting new applications.'
          : 'Reopen this job? The apply link will accept applications again.'}
      </Text>
      {update.error ? <InlineAlert tone="error" message={update.error.message} /> : null}
      <View className="flex-row gap-2">
        <Button title="Cancel" variant="secondary" size="md" className="flex-1" onPress={() => setConfirming(false)} />
        <Button
          title={closing ? 'Close job' : 'Reopen'}
          variant={closing ? 'danger' : 'primary'}
          size="md"
          className="flex-1"
          loading={update.isPending}
          testID="confirm-toggle-status"
          onPress={() =>
            update.mutateAsync({ status: closing ? 'closed' : 'open' }).then(
              () => setConfirming(false),
              () => {}
            )
          }
        />
      </View>
    </Card>
  );
}

export default function JobDetailScreen() {
  const { jobId } = useLocalSearchParams();
  const { colors } = useTheme();
  const query = useJob(jobId);

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/jobs" />
        <View className="gap-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/jobs" />
        <ErrorState
          error={query.error}
          title={query.error.status === 404 ? 'Job not found' : undefined}
          onRetry={query.error.status === 404 ? undefined : query.refetch}
        />
      </Screen>
    );
  }

  const { job, can_manage: canManage } = query.data;

  return (
    <Screen
      edges={['top']}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.muted} />}
    >
      <ScreenHeader
        fallbackHref="/dashboard/jobs"
        right={
          canManage ? (
            <Button
              title="Edit"
              icon={Pencil}
              variant="ghost"
              size="sm"
              onPress={() => router.push(`/dashboard/jobs/${job.id}/edit`)}
              testID="edit-job"
            />
          ) : null
        }
      />
      <View className="gap-5">
        <View className="gap-2">
          <JobStatusBadge status={job.status} />
          <Text variant="title" testID="job-detail-title">
            {job.title}
          </Text>
          <Text variant="label" tone="muted" className="font-normal">
            {formatExperience(job.min_experience)} · Created {formatDate(job.created_at)}
          </Text>
        </View>

        {!canManage ? <InlineAlert tone="info" message="This job belongs to another recruiter. You can view it but not edit it." /> : null}

        <ShareLinkCard job={job} />

        {canManage ? (
          <Card testID="job-candidates-card">
            <CardHeader
              title="Candidates"
              subtitle={`${job.candidate_count ?? 0} ${job.candidate_count === 1 ? 'application' : 'applications'} received`}
            />
            <View className="flex-row gap-2">
              <Button
                title="View candidates"
                icon={Users}
                size="md"
                className="flex-1"
                onPress={() => router.push(`/dashboard/candidates?jobId=${job.id}`)}
                testID="view-job-candidates"
              />
              <Button
                title="Public page"
                icon={ExternalLink}
                variant="secondary"
                size="md"
                className="flex-1"
                onPress={() => router.push(`/jobs/${job.id}`)}
                testID="open-public-page"
              />
            </View>
          </Card>
        ) : null}

        <Card className="gap-4">
          <View className="gap-2">
            <Text variant="label" tone="muted">
              Required skills
            </Text>
            <ChipList items={job.required_skills} tone="primary" testID="detail-required" />
          </View>
          <View className="gap-2">
            <Text variant="label" tone="muted">
              Preferred skills
            </Text>
            {job.preferred_skills.length ? (
              <ChipList items={job.preferred_skills} testID="detail-preferred" />
            ) : (
              <Text tone="subtle">None</Text>
            )}
          </View>
        </Card>

        <Card>
          <Text variant="heading" className="mb-2">
            Description
          </Text>
          <Text tone="muted" selectable>
            {job.description}
          </Text>
        </Card>

        {canManage ? (
          <Card>
            <Text variant="heading" className="mb-1">
              Configuration
            </Text>
            <DetailRow label="Base role" value={job.hiring_spec?.role ?? job.hiring_spec_id} />
            <DetailRow label="Hiring spec" value={`${job.hiring_spec_id}${job.hiring_spec ? ` v${job.hiring_spec.version}` : ''}`} />
            <DetailRow label="Workflow" value={job.workflow_spec_id} />
            <DetailRow label="Last updated" value={formatDate(job.updated_at)} last />
          </Card>
        ) : null}

        {canManage ? <StatusAction job={job} /> : null}
      </View>
    </Screen>
  );
}
