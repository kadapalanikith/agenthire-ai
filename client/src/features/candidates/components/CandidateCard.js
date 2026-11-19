import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Skeleton, Text } from '../../../components/ui';
import { formatDate } from '../../../lib/format';
import { CANDIDATE_STATUS_META } from '../status';

export function CandidateStatusBadge({ status }) {
  const meta = CANDIDATE_STATUS_META[status] || { label: status, tone: 'neutral' };
  return <Badge label={meta.label} tone={meta.tone} />;
}

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

/** Score display: never invent a number before the matching agent has produced one. */
export function MatchScore({ score }) {
  if (score === null || score === undefined) {
    return (
      <Text variant="caption" tone="subtle">
        Not scored yet
      </Text>
    );
  }
  return (
    <Text variant="label" className="font-semibold">
      {Math.round(score)}
      <Text variant="caption" tone="muted">
        {' '}
        / 100
      </Text>
    </Text>
  );
}

export function CandidateCard({ candidate, showJob = true }) {
  return (
    <Pressable
      testID={`candidate-card-${candidate.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${candidate.name}, ${CANDIDATE_STATUS_META[candidate.status]?.label || candidate.status}`}
      onPress={() => router.push(`/dashboard/candidates/${candidate.id}`)}
      className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4"
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-primary-muted">
        <Text variant="label" tone="primary" className="font-semibold">
          {initials(candidate.name)}
        </Text>
      </View>
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold" numberOfLines={1}>
          {candidate.name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {showJob && candidate.job ? `${candidate.job.title} · ` : ''}Applied {formatDate(candidate.created_at)}
        </Text>
      </View>
      <View className="items-end gap-1.5">
        <CandidateStatusBadge status={candidate.status} />
        <MatchScore score={candidate.match_score} />
      </View>
    </Pressable>
  );
}

export function CandidateCardSkeleton() {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-surface p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <View className="flex-1 gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </View>
      <Skeleton className="h-6 w-20 rounded-full" />
    </View>
  );
}
