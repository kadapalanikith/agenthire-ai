import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Card, Text } from '../../../components/ui';
import { useTheme } from '../../../theme/ThemeProvider';
import { formatDuration, formatTime, nodeLabel } from '../format';
import { NodeStatusPill } from './NodeStatusPill';

function Row({ label, value }) {
  return (
    <View className="flex-row justify-between gap-4 border-b border-border py-2">
      <Text tone="muted">{label}</Text>
      <Text className="flex-1 text-right" selectable>
        {value}
      </Text>
    </View>
  );
}

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === 'object' ? JSON.stringify(x) : String(x))).join(', ') : 'none';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Show a few useful output fields per agent (all real values from state_output). */
const OUTPUT_FIELDS = {
  resume_parser: ['parse_source', 'llm', 'skills', 'experience_years', 'education_count', 'project_count'],
  embedding_agent: ['collection', 'chunk_count', 'chunk_size', 'embedding_model'],
  matching_agent: ['match_score', 'matched_required_skills', 'matched_preferred_skills', 'missing_skills', 'explanation_source', 'explanation'],
  shortlisting_agent: ['decision', 'applied_band', 'role_minimum_score', 'role_minimum_applied', 'recommendation_only', 'spec_version'],
  human_approval: ['decision', 'ai_recommendation', 'overridden', 'reason', 'decided_at'],
};

/** Bottom-sheet style modal with one agent's execution details and attempt history. */
export function AgentDetailSheet({ spec, node, output, logs, onClose }) {
  const { colors } = useTheme();
  if (!node) return null;
  const fields = OUTPUT_FIELDS[node.name] || (output ? Object.keys(output).slice(0, 8) : []);
  const attempts = logs.filter((l) => l.agent_name === node.name);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} transparent={false}>
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-row items-center justify-between border-b border-border px-5 py-3">
          <View className="flex-1 gap-1">
            <Text variant="heading" testID="agent-sheet-title">
              {nodeLabel(spec, node.name)}
            </Text>
            <NodeStatusPill spec={spec} status={node.status} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12} testID="agent-sheet-close">
            <X size={22} color={colors.foreground} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, maxWidth: 600, width: '100%', alignSelf: 'center' }}>
          <Card>
            <Text variant="label" tone="muted" className="mb-1">
              Execution
            </Text>
            <Row label="Started" value={formatTime(node.started_at)} />
            <Row label="Completed" value={formatTime(node.completed_at)} />
            <Row label="Duration" value={formatDuration(node.duration_ms)} />
            <Row label="Attempts (total)" value={String(node.attempts ?? 0)} />
          </Card>

          <Card testID="agent-sheet-output">
            <Text variant="label" tone="muted" className="mb-1">
              Output
            </Text>
            {output ? (
              fields.filter((f) => f in output).map((f) => <Row key={f} label={f.replace(/_/g, ' ')} value={formatValue(output[f])} />)
            ) : (
              <Text tone="subtle">{node.status === 'skipped' ? 'This step was skipped by the chosen branch.' : 'No output yet.'}</Text>
            )}
          </Card>

          <Card testID="agent-sheet-attempts">
            <Text variant="label" tone="muted" className="mb-1">
              Attempt history
            </Text>
            {attempts.length ? (
              attempts.map((l) => (
                <View key={l.id} className="gap-0.5 border-b border-border py-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="font-medium">
                      Attempt {l.attempt} · {formatTime(l.created_at)}
                    </Text>
                    <NodeStatusPill spec={spec} status={l.status} />
                  </View>
                  {l.duration_ms !== null && l.duration_ms !== undefined ? (
                    <Text variant="caption" tone="muted">
                      {formatDuration(l.duration_ms)}
                    </Text>
                  ) : null}
                  {l.error ? (
                    <Text variant="caption" tone="danger" selectable>
                      {l.error.code}: {l.error.message} {l.error.retryable ? '(retryable)' : '(not retryable)'}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <Text tone="subtle">This step has not run yet.</Text>
            )}
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
