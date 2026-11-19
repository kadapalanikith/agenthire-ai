import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Copy, Check } from 'lucide-react-native';
import { Button, Card, ErrorState, InlineAlert, Skeleton, Text } from '../../src/components/ui';
import { PublicLayout } from '../../src/features/apply/components/PublicLayout';
import { ApplicationProgress } from '../../src/features/apply/components/ApplicationProgress';
import { useApplicationStatus } from '../../src/features/apply/hooks';
import { useShareLink } from '../../src/features/jobs/useShareLink';
import { formatDate } from '../../src/lib/format';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL;

/** Public confirmation + status page. The token in the URL is the candidate's private status key. */
export default function ApplicationStatusScreen() {
  const { statusToken, submitted } = useLocalSearchParams();
  const status = useApplicationStatus(typeof statusToken === 'string' ? statusToken : '');
  const { status: copyStatus, copy } = useShareLink();
  const statusUrl = WEB_URL ? `${WEB_URL.replace(/\/+$/, '')}/applications/${statusToken}` : null;

  if (status.isPending) {
    return (
      <PublicLayout>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </PublicLayout>
    );
  }

  if (status.isError) {
    const missing = status.error.status === 404 || status.error.status === 400;
    return (
      <PublicLayout>
        <ErrorState
          error={missing ? { message: 'This status link is invalid. Make sure you copied the whole link.' } : status.error}
          title={missing ? 'Application not found' : undefined}
          onRetry={missing ? undefined : status.refetch}
        />
      </PublicLayout>
    );
  }

  const s = status.data;

  return (
    <PublicLayout>
      {submitted ? (
        <InlineAlert
          tone="success"
          title="Application submitted"
          message={`Thanks, ${s.applicant_name}. We've received your application${s.job ? ` for ${s.job.title}` : ''}.`}
        />
      ) : null}

      <View className="gap-1">
        <Text variant="label" tone="muted" className="font-normal">
          Application status
        </Text>
        <Text variant="title" testID="status-job-title">
          {s.job ? s.job.title : 'Your application'}
        </Text>
        <Text variant="label" tone="muted" className="font-normal">
          Submitted {formatDate(s.submitted_at)}
        </Text>
      </View>

      <Card>
        <ApplicationProgress stage={s.stage} />
      </Card>

      {statusUrl ? (
        <Card className="gap-3">
          <Text variant="heading">Keep this link</Text>
          <Text variant="label" tone="muted" className="font-normal">
            Bookmark or save this page to check your status later. Anyone with the link can see your application stage,
            so keep it private.
          </Text>
          <Button
            title={copyStatus === 'copied' ? 'Copied' : 'Copy status link'}
            icon={copyStatus === 'copied' ? Check : Copy}
            variant="secondary"
            size="md"
            onPress={() => copy(statusUrl)}
            testID="copy-status-link"
          />
        </Card>
      ) : null}
    </PublicLayout>
  );
}
