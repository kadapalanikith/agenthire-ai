import { Pressable, RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, FileText, Mail, Phone } from 'lucide-react-native';
import { Badge, Button, Card, CardHeader, ErrorState, InlineAlert, Screen, ScreenHeader, Skeleton, Text } from '../../../../src/components/ui';
import { CandidateStatusBadge, MatchScore } from '../../../../src/features/candidates/components/CandidateCard';
import { useCandidate, useOpenResume } from '../../../../src/features/candidates/hooks';
import { WORKFLOW_STATUS_META } from '../../../../src/features/candidates/status';
import { formatBytes } from '../../../../src/features/apply/resumeFile';
import { formatDate } from '../../../../src/lib/format';
import { useTheme } from '../../../../src/theme/ThemeProvider';

function ContactRow({ icon: Icon, value, testID }) {
  const { colors } = useTheme();
  return (
    <View className="flex-row items-center gap-3 py-2">
      <Icon size={16} color={colors.muted} />
      <Text selectable className="flex-1" testID={testID}>
        {value}
      </Text>
    </View>
  );
}

export default function CandidateDetailScreen() {
  const { candidateId } = useLocalSearchParams();
  const { colors } = useTheme();
  const query = useCandidate(candidateId);
  const resume = useOpenResume(candidateId);

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/candidates" />
        <View className="gap-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/candidates" />
        <ErrorState
          error={query.error}
          title={query.error.status === 404 ? 'Candidate not found' : undefined}
          onRetry={query.error.status === 404 ? undefined : query.refetch}
        />
      </Screen>
    );
  }

  const c = query.data;
  const wfMeta = c.workflow ? WORKFLOW_STATUS_META[c.workflow.status] : null;

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.muted} />}>
      <ScreenHeader fallbackHref="/dashboard/candidates" />
      <View className="gap-5">
        <View className="gap-2">
          <CandidateStatusBadge status={c.status} />
          <Text variant="title" testID="candidate-name">
            {c.name}
          </Text>
          <Text variant="label" tone="muted" className="font-normal">
            Applied {formatDate(c.created_at)}
          </Text>
        </View>

        <Card>
          <CardHeader title="Contact" />
          <ContactRow icon={Mail} value={c.email} testID="candidate-email" />
          <ContactRow icon={Phone} value={c.phone} testID="candidate-phone" />
        </Card>

        {c.job ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/dashboard/jobs/${c.job.id}`)}
            className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            testID="candidate-job"
          >
            <View className="flex-1 gap-0.5">
              <Text variant="caption" tone="muted">
                Applied for
              </Text>
              <Text className="font-semibold">{c.job.title}</Text>
            </View>
            <ChevronRight size={18} color={colors.subtle} />
          </Pressable>
        ) : null}

        <Card>
          <CardHeader
            title="Resume"
            subtitle={`${c.resume_file.original_name} · ${formatBytes(c.resume_file.size_bytes)}`}
          />
          {resume.error ? <InlineAlert tone="error" message={resume.error.message} className="mb-3" /> : null}
          <Button title="View resume" icon={FileText} variant="secondary" size="md" onPress={resume.open} loading={resume.loading} testID="view-resume" />
        </Card>

        <Card>
          <CardHeader title="AI screening" right={<MatchScore score={c.match_score} />} />
          {c.workflow ? (
            <View className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text tone="muted">Workflow</Text>
                <Badge label={wfMeta?.label || c.workflow.status} tone={wfMeta?.tone || 'neutral'} />
              </View>
              {c.workflow.current_state ? (
                <View className="flex-row items-center justify-between">
                  <Text tone="muted">Current step</Text>
                  <Text>{c.workflow.current_state}</Text>
                </View>
              ) : null}
              {c.workflow.status === 'pending' ? (
                <Text variant="label" tone="muted" className="font-normal" testID="screening-pending">
                  The application is stored and queued. No AI screening results exist yet.
                </Text>
              ) : null}
            </View>
          ) : (
            <Text tone="muted">No workflow has been created for this application.</Text>
          )}
        </Card>
      </View>
    </Screen>
  );
}
