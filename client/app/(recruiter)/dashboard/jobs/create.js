import { router } from 'expo-router';
import { Screen, ScreenHeader } from '../../../../src/components/ui';
import { JobForm } from '../../../../src/features/jobs/components/JobForm';
import { useCreateJob } from '../../../../src/features/jobs/hooks';

export default function CreateJobScreen() {
  const create = useCreateJob();

  const submit = (payload) =>
    create.mutateAsync(payload).then(({ job }) => {
      router.replace(`/dashboard/jobs/${job.id}`);
    });

  return (
    <Screen edges={['top']}>
      <ScreenHeader
        title="Create job"
        subtitle="Define the role. Candidates are matched against these requirements."
        fallbackHref="/dashboard/jobs"
      />
      <JobForm onSubmit={submit} submitLabel="Publish job" submitting={create.isPending} mutationError={create.error} />
    </Screen>
  );
}
