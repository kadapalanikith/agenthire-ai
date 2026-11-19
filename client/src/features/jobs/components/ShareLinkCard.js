import { View } from 'react-native';
import { Check, Copy, Share2 } from 'lucide-react-native';
import { Button, Card, CardHeader, Text } from '../../../components/ui';
import { useShareLink } from '../useShareLink';

/** Public apply link with copy and native share. */
export function ShareLinkCard({ job }) {
  const { status, copy, share } = useShareLink();
  const closed = job.status !== 'open';
  return (
    <Card testID="share-card">
      <CardHeader
        title="Public apply link"
        subtitle={
          closed
            ? 'This job is closed. Reopen it before sharing so candidates can apply.'
            : 'Candidates apply in any browser. No account or app install needed.'
        }
      />
      <View className="mb-3 rounded-xl border border-border bg-surface-muted px-3 py-2.5">
        <Text variant="label" className="font-normal" selectable numberOfLines={2} testID="apply-url">
          {job.apply_url}
        </Text>
      </View>
      <View className="flex-row gap-2">
        <Button
          title={status === 'copied' ? 'Copied' : 'Copy link'}
          icon={status === 'copied' ? Check : Copy}
          variant="secondary"
          size="md"
          className="flex-1"
          onPress={() => copy(job.apply_url)}
          testID="copy-apply-link"
        />
        <Button
          title="Share"
          icon={Share2}
          variant="secondary"
          size="md"
          className="flex-1"
          onPress={() => share({ url: job.apply_url, title: `Apply: ${job.title}` })}
          testID="share-apply-link"
        />
      </View>
      {status === 'error' ? (
        <Text variant="caption" tone="danger" className="mt-2">
          Couldn't access the clipboard. Select the link above to copy it.
        </Text>
      ) : null}
    </Card>
  );
}
