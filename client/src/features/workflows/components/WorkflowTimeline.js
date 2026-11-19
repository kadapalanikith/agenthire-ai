import { ActivityIndicator, Pressable, View } from 'react-native';
import { AlertTriangle, Check, ChevronRight, Clock, Hand, Minus } from 'lucide-react-native';
import { Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatDuration, formatTime, nodeLabel, nodeStateStyle } from '../format';
import { NodeStatusPill } from './NodeStatusPill';

const ICONS = { success: Check, failed: AlertTriangle, waiting_approval: Hand, skipped: Minus, pending: Clock };

function StepMarker({ spec, status }) {
  const { scheme, colors } = useTheme();
  const s = nodeStateStyle(spec, status, scheme);
  const Icon = ICONS[status];
  return (
    <View
      className="h-8 w-8 items-center justify-center rounded-full border"
      style={{ backgroundColor: s.bg || colors['surface-muted'], borderColor: s.border || colors.border }}
    >
      {status === 'running' ? <ActivityIndicator size="small" color={s.fg} /> : Icon ? <Icon size={15} color={s.fg || colors.muted} strokeWidth={2.4} /> : null}
    </View>
  );
}

/**
 * Vertical timeline of the seven agents with live backend state. Each step
 * shows status, timestamps, duration, attempts, a short output summary and
 * errors; tapping opens the agent's details.
 */
export function WorkflowTimeline({ spec, nodes, summaries, errors, currentState, onSelect }) {
  const { colors } = useTheme();
  return (
    <View testID="workflow-timeline">
      {nodes.map((node, i) => {
        const last = i === nodes.length - 1;
        const active = node.name === currentState;
        return (
          <Pressable
            key={node.name}
            testID={`timeline-step-${node.name}`}
            accessibilityRole="button"
            accessibilityLabel={`${nodeLabel(spec, node.name)}: ${node.status}. Show details`}
            onPress={() => onSelect(node.name)}
            className="flex-row gap-3"
            style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
          >
            <View className="items-center">
              <StepMarker spec={spec} status={node.status} />
              {!last ? <View className="w-0.5 flex-1" style={{ minHeight: 18, backgroundColor: node.status === 'success' || node.status === 'skipped' ? colors['border-strong'] : colors.border }} /> : null}
            </View>
            <View className={`flex-1 rounded-xl ${last ? '' : 'mb-3'} ${active ? 'border border-primary/40 bg-primary-muted p-3' : 'pb-1 pt-1'}`}>
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="font-semibold">
                    {i + 1}. {nodeLabel(spec, node.name)}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {node.started_at ? `${formatTime(node.started_at)}${node.completed_at ? ` → ${formatTime(node.completed_at)}` : ''}` : 'Not started'}
                    {node.duration_ms !== null && node.duration_ms !== undefined ? ` · ${formatDuration(node.duration_ms)}` : ''}
                    {node.attempts > 1 ? ` · ${node.attempts} attempts` : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <NodeStatusPill spec={spec} status={node.status} testID={`timeline-status-${node.name}`} />
                  <ChevronRight size={16} color={colors.subtle} />
                </View>
              </View>
              {summaries[node.name] ? (
                <Text variant="label" tone="muted" className="mt-1 font-normal" numberOfLines={2}>
                  {summaries[node.name]}
                </Text>
              ) : null}
              {errors[node.name] && node.status === 'failed' ? (
                <Text variant="label" tone="danger" className="mt-1 font-normal" numberOfLines={3} testID={`timeline-error-${node.name}`}>
                  {errors[node.name].code}: {errors[node.name].message}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
