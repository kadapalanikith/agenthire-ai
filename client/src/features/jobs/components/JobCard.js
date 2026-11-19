import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Briefcase, Copy, Check } from 'lucide-react-native';
import { ChipList, Skeleton, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatDate, formatExperience } from '../../../lib/format';
import { JobStatusBadge } from './JobStatusBadge';
import { useShareLink } from '../useShareLink';

export function JobCard({ job }) {
  const { colors } = useTheme();
  const { status, copy } = useShareLink();
  const copied = status === 'copied';

  return (
    <Pressable
      testID={`job-card-${job.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${job.title}, ${job.status}`}
      onPress={() => router.push(`/dashboard/jobs/${job.id}`)}
      className="rounded-2xl border border-border bg-surface p-4"
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-xl bg-surface-muted">
          <Briefcase size={17} color={colors.muted} />
        </View>
        <View className="flex-1 gap-1">
          <Text variant="heading" numberOfLines={2}>
            {job.title}
          </Text>
          <Text variant="caption" tone="muted">
            {formatExperience(job.min_experience)} · Created {formatDate(job.created_at)}
          </Text>
        </View>
        <JobStatusBadge status={job.status} />
      </View>

      <View className="mt-3">
        <ChipList items={job.required_skills} max={4} />
      </View>

      <View className="mt-3 flex-row items-center justify-between border-t border-border pt-3">
        <Text variant="caption" tone="subtle" numberOfLines={1} className="flex-1 pr-3">
          {job.apply_url}
        </Text>
        <Pressable
          testID={`copy-link-${job.id}`}
          accessibilityRole="button"
          accessibilityLabel="Copy public apply link"
          hitSlop={8}
          onPress={() => copy(job.apply_url)}
          className="flex-row items-center gap-1.5"
        >
          {copied ? <Check size={15} color={colors.success} /> : <Copy size={15} color={colors.primary} />}
          <Text variant="label" tone={copied ? 'success' : 'primary'} className="font-semibold">
            {copied ? 'Copied' : 'Copy apply link'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

export function JobCardSkeleton() {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <View className="flex-1 gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </View>
      </View>
      <View className="flex-row gap-1.5">
        <Skeleton className="h-7 w-16 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-12 rounded-full" />
      </View>
    </View>
  );
}
