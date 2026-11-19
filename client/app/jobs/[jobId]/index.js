import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Badge, Button, Card, ChipList, ErrorState, InlineAlert, Skeleton, Text } from '../../../src/components/ui';
import { PublicLayout } from '../../../src/features/apply/components/PublicLayout';
import { usePublicJob } from '../../../src/features/apply/hooks';
import { formatDate, formatExperience } from '../../../src/lib/format';

/** Public job page (shareable link). No account required. */
export default function PublicJobScreen() {
  const { jobId } = useLocalSearchParams();
  const job = usePublicJob(jobId);

  if (job.isPending) {
    return (
      <PublicLayout>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </PublicLayout>
    );
  }

  if (job.isError) {
    const missing = job.error.status === 404 || job.error.status === 400;
    return (
      <PublicLayout>
        <ErrorState
          error={missing ? { message: 'This job link is invalid or the job has been removed.' } : job.error}
          title={missing ? 'Job not found' : undefined}
          onRetry={missing ? undefined : job.refetch}
        />
      </PublicLayout>
    );
  }

  const j = job.data;
  const open = j.status === 'open';

  return (
    <PublicLayout>
      <View className="gap-2">
        {open ? <Badge label="Accepting applications" tone="success" /> : <Badge label="Closed" />}
        <Text variant="display" testID="public-job-title">
          {j.title}
        </Text>
        <Text tone="muted">
          {formatExperience(j.min_experience)} · Posted {formatDate(j.created_at)}
        </Text>
      </View>

      {!open ? <InlineAlert tone="warning" title="This job is closed" message="It is no longer accepting applications." /> : null}

      <Card>
        <Text variant="heading" className="mb-2">
          About the role
        </Text>
        <Text tone="muted">{j.description}</Text>
      </Card>

      <Card className="gap-4">
        <View className="gap-2">
          <Text variant="label" tone="muted">
            Required skills
          </Text>
          <ChipList items={j.required_skills} tone="primary" />
        </View>
        {j.preferred_skills.length ? (
          <View className="gap-2">
            <Text variant="label" tone="muted">
              Nice to have
            </Text>
            <ChipList items={j.preferred_skills} />
          </View>
        ) : null}
      </Card>

      {open ? (
        <Button
          title="Apply now"
          icon={ArrowRight}
          onPress={() => router.push(`/jobs/${j.id}/apply`)}
          testID="apply-now"
        />
      ) : null}
    </PublicLayout>
  );
}
