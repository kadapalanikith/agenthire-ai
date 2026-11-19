import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ErrorState, Screen, ScreenHeader, Skeleton } from '../../../../../src/components/ui';
import { JobForm } from '../../../../../src/features/jobs/components/JobForm';
import { useJob, useUpdateJob } from '../../../../../src/features/jobs/hooks';
import { jobToFormValues } from '../../../../../src/features/jobs/schemas';

export default function EditJobScreen() {
  const { jobId } = useLocalSearchParams();
  const job = useJob(jobId);
  const update = useUpdateJob(jobId);
  const detailHref = `/dashboard/jobs/${jobId}`;

  const submit = (payload) =>
    update.mutateAsync(payload).then(() => {
      if (router.canGoBack()) router.back();
      else router.replace(detailHref);
    });

  let content;
  if (job.isPending) {
    content = (
      <View className="gap-4">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </View>
    );
  } else if (job.isError) {
    content = <ErrorState error={job.error} onRetry={job.refetch} />;
  } else if (!job.data.can_manage) {
    content = <ErrorState error={{ message: 'Only the recruiter who created this job can edit it.' }} title="Not editable" />;
  } else {
    content = (
      <JobForm
        initialValues={jobToFormValues(job.data.job)}
        onSubmit={submit}
        submitLabel="Save changes"
        submitting={update.isPending}
        mutationError={update.error}
        showStatus
      />
    );
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Edit job" fallbackHref={detailHref} />
      {content}
    </Screen>
  );
}
