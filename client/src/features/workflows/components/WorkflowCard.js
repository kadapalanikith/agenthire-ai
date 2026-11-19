import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Skeleton, Text } from '../../../components/ui';
import { WORKFLOW_STATUS_META } from '../../candidates/status';
import { formatTime, nodeLabel } from '../format';
import { NodeProgressDots } from './NodeStatusPill';

export function WorkflowCard({ workflow, spec }) {
  const meta = WORKFLOW_STATUS_META[workflow.status] || { label: workflow.status, tone: 'neutral' };
  return (
    <Pressable
      testID={`workflow-card-${workflow.id}`}
      accessibilityRole="button"
      onPress={() => router.push(`/dashboard/workflows/${workflow.id}`)}
      className="gap-3 rounded-2xl border border-border bg-surface p-4"
      style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 gap-0.5">
          <Text className="font-semibold" numberOfLines={1}>
            {workflow.candidate?.name || 'Candidate'}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {workflow.job?.title || 'Job'} · updated {formatTime(workflow.updated_at)}
          </Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} />
      </View>
      <NodeProgressDots spec={spec} nodes={workflow.nodes} testID={`workflow-dots-${workflow.id}`} />
      <Text variant="caption" tone={workflow.status === 'failed' ? 'danger' : 'muted'} numberOfLines={1}>
        {workflow.status === 'failed' && workflow.last_error
          ? `Failed at ${nodeLabel(spec, workflow.last_error.agent_name)}: ${workflow.last_error.code}`
          : workflow.current_state
            ? `At ${nodeLabel(spec, workflow.current_state)}`
            : workflow.status === 'completed'
              ? 'All steps finished'
              : 'Queued'}
      </Text>
    </Pressable>
  );
}

export function WorkflowCardSkeleton() {
  return (
    <View className="gap-3 rounded-2xl border border-border bg-surface p-4">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-2 w-full rounded-full" />
      <Skeleton className="h-3 w-1/3" />
    </View>
  );
}
