import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronLeft } from 'lucide-react-native';
import { Button, Card, ErrorState, FormTextField, InlineAlert, Skeleton, Text } from '../../../src/components/ui';
import { PublicLayout } from '../../../src/features/apply/components/PublicLayout';
import { ResumePicker } from '../../../src/features/apply/components/ResumePicker';
import { usePublicJob, useSubmitApplication, useUploadPolicy } from '../../../src/features/apply/hooks';
import { APPLICATION_FIELDS, applicationSchema } from '../../../src/features/apply/schemas';
import { buildApplicationFormData, formatBytes, validateResumeFile } from '../../../src/features/apply/resumeFile';
import { applyFieldErrors } from '../../../src/api/client';
import { useTheme } from '../../../src/theme/ThemeProvider';

const FILE_ERROR_CODES = ['INVALID_PDF', 'INVALID_FILE_TYPE', 'FILE_TOO_LARGE'];

/** Public application form. No recruiter authentication and no app install required. */
export default function ApplyScreen() {
  const { jobId } = useLocalSearchParams();
  const { colors } = useTheme();
  const job = usePublicJob(jobId);
  const policy = useUploadPolicy();
  const submit = useSubmitApplication();
  const [resume, setResume] = useState(null);
  const [resumeError, setResumeError] = useState(null);

  const { control, handleSubmit, setError } = useForm({
    resolver: zodResolver(applicationSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  const chooseResume = (asset) => {
    setResume(asset);
    setResumeError(asset ? validateResumeFile(asset, policy.data) : null);
  };

  const onSubmit = handleSubmit(
    async (values) => {
      const fileError = validateResumeFile(resume, policy.data);
      if (fileError) {
        setResumeError(fileError);
        return;
      }
      try {
        const result = await submit.mutateAsync(buildApplicationFormData({ jobId, ...values }, resume));
        router.replace(`/applications/${result.status_token}?submitted=1`);
      } catch (err) {
        if (FILE_ERROR_CODES.includes(err.code)) setResumeError(err.message);
        applyFieldErrors(err, setError, APPLICATION_FIELDS);
        if (err.code === 'VALIDATION_ERROR' && err.details?.some((d) => d.path === 'resume')) setResumeError('Attach your resume as a PDF');
      }
    },
    () => {
      // Show the resume error alongside field errors.
      setResumeError(validateResumeFile(resume, policy.data));
    }
  );

  const backToJob = () => (router.canGoBack() ? router.back() : router.replace(`/jobs/${jobId}`));

  if (job.isPending) {
    return (
      <PublicLayout>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-72 w-full rounded-2xl" />
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

  const open = job.data.status === 'open';
  const err = submit.error;
  const formError =
    err && !['VALIDATION_ERROR', ...FILE_ERROR_CODES].includes(err.code)
      ? err.code === 'ALREADY_APPLIED'
        ? { title: 'Already applied', message: err.message }
        : err.code === 'JOB_CLOSED'
          ? { title: 'Applications closed', message: err.message }
          : { title: "Couldn't submit your application", message: err.message }
      : null;

  return (
    <PublicLayout>
      <Pressable accessibilityRole="button" onPress={backToJob} className="-ml-1.5 flex-row items-center self-start" testID="apply-back">
        <ChevronLeft size={20} color={colors.foreground} />
        <Text variant="label">Job details</Text>
      </Pressable>

      <View className="gap-1">
        <Text variant="label" tone="muted" className="font-normal">
          Apply for
        </Text>
        <Text variant="title" testID="apply-job-title">
          {job.data.title}
        </Text>
      </View>

      {!open ? (
        <InlineAlert tone="warning" title="This job is closed" message="It is no longer accepting applications." />
      ) : (
        <>
          {formError ? <InlineAlert tone="error" title={formError.title} message={formError.message} /> : null}

          <Card className="gap-4">
            <FormTextField control={control} name="name" label="Full name" placeholder="Jane Doe" autoComplete="name" textContentType="name" editable={!submit.isPending} testID="apply-name" />
            <FormTextField
              control={control}
              name="email"
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!submit.isPending}
              testID="apply-email"
            />
            <FormTextField
              control={control}
              name="phone"
              label="Phone number"
              placeholder="+1 555 123 4567"
              autoComplete="tel"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              editable={!submit.isPending}
              testID="apply-phone"
            />
            <ResumePicker
              value={resume}
              onChange={chooseResume}
              error={resumeError}
              disabled={submit.isPending}
              maxSizeLabel={policy.data ? formatBytes(policy.data.max_size_bytes) : null}
            />
          </Card>

          {submit.isPending ? (
            <Card className="flex-row items-center gap-3" testID="apply-processing">
              <ActivityIndicator color={colors.primary} />
              <View className="flex-1">
                <Text className="font-semibold">Submitting your application…</Text>
                <Text variant="label" tone="muted" className="font-normal">
                  Uploading your resume. Keep this page open.
                </Text>
              </View>
            </Card>
          ) : null}

          <Text variant="caption" tone="subtle">
            By applying, you agree that your resume will be screened with AI assistance. A recruiter reviews every
            application before any decision is made.
          </Text>
          <Button title="Submit application" onPress={onSubmit} loading={submit.isPending} testID="apply-submit" />
        </>
      )}
    </PublicLayout>
  );
}
