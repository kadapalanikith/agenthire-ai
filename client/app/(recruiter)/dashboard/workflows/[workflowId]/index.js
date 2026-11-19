import { useMemo, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Gavel, RotateCcw, User } from 'lucide-react-native';
import { Badge, Button, Card, CardHeader, ErrorState, InlineAlert, Screen, ScreenHeader, Skeleton, Text } from '../../../../../src/components/ui';
import { WorkflowTimeline } from '../../../../../src/features/workflows/components/WorkflowTimeline';
import { AgentDetailSheet } from '../../../../../src/features/workflows/components/AgentDetailSheet';
import { useRetryWorkflow, useWorkflow, useWorkflowSpec } from '../../../../../src/features/workflows/hooks';
import { latestErrors, summarizeOutputs } from '../../../../../src/features/workflows/summaries';
import { nodeLabel } from '../../../../../src/features/workflows/format';
import { RECOMMENDATION_META, WORKFLOW_STATUS_META } from '../../../../../src/features/candidates/status';
import { useTheme } from '../../../../../src/theme/ThemeProvider';

export default function WorkflowDetailScreen() {
  const { workflowId } = useLocalSearchParams();
  const { colors } = useTheme();
  const query = useWorkflow(workflowId);
  const spec = useWorkflowSpec();
  const retry = useRetryWorkflow(workflowId);
  const [selected, setSelected] = useState(null);

  const derived = useMemo(() => {
    if (!query.data) return null;
    return { summaries: summarizeOutputs(query.data.state_output), errors: latestErrors(query.data.logs) };
  }, [query.data]);

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/workflows" />
        <View className="gap-4">
          <Skeleton className="h-8 w-1/2" />
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </View>
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref="/dashboard/workflows" />
        <ErrorState
          error={query.error}
          title={query.error.status === 404 ? 'Workflow not found' : undefined}
          onRetry={query.error.status === 404 ? undefined : query.refetch}
        />
      </Screen>
    );
  }

  const d = query.data;
  const wf = d.workflow;
  const meta = WORKFLOW_STATUS_META[wf.status] || { label: wf.status, tone: 'neutral' };
  const selectedNode = selected ? d.nodes.find((n) => n.name === selected) : null;
  const rec = d.approval_request ? RECOMMENDATION_META[d.approval_request.ai_recommendation] : null;

  return (
    <Screen edges={['top']} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.muted} />}>
      <ScreenHeader fallbackHref="/dashboard/workflows" />
      <View className="gap-5">
        <View className="gap-2">
          <Badge label={meta.label} tone={meta.tone} testID="workflow-status" />
          <Text variant="title" testID="workflow-candidate">
            {d.candidate?.name || 'Candidate'}
          </Text>
          <Text variant="label" tone="muted" className="font-normal">
            {d.job?.title}
            {wf.retry_count ? ` · retried ${wf.retry_count}×` : ''}
          </Text>
        </View>

        {wf.status === 'waiting_approval' && d.approval_request ? (
          <Card className="gap-3 border-warning/40 bg-warning-muted" testID="approval-cta">
            <Text className="font-semibold">Your decision is needed</Text>
            <Text variant="label" className="font-normal">
              AI recommendation: {rec?.label || d.approval_request.ai_recommendation} · score {d.approval_request.match_score}/100. The workflow is paused
              until you approve or reject.
            </Text>
            <Button title="Review and decide" icon={Gavel} onPress={() => router.push(`/dashboard/workflows/${wf.id}/approval`)} testID="go-approval" />
          </Card>
        ) : null}

        {wf.status === 'failed' && wf.last_error ? (
          <Card className="gap-3 border-danger/30" testID="failure-card">
            <InlineAlert
              tone="error"
              title={`Failed at ${nodeLabel(spec.data, wf.last_error.agent_name)}`}
              message={`${wf.last_error.code}: ${wf.last_error.message}`}
            />
            <Text variant="caption" tone="muted">
              {wf.last_error.retryable
                ? 'This error is temporary (for example a service timeout). Retrying resumes from this step; completed steps are not repeated.'
                : 'This error is not temporary. Fix the cause first; retrying resumes from this step.'}
            </Text>
            {retry.error ? <InlineAlert tone="error" message={retry.error.message} /> : null}
            <Button title="Retry from this step" icon={RotateCcw} variant="secondary" onPress={() => retry.mutate()} loading={retry.isPending} testID="retry-workflow" />
          </Card>
        ) : null}

        {wf.approval ? (
          <Card testID="decision-card">
            <CardHeader title="Recruiter decision" right={<Badge label={wf.approval.decision === 'approve' ? 'Approved' : 'Rejected'} tone={wf.approval.decision === 'approve' ? 'success' : 'danger'} />} />
            <Text variant="label" tone="muted" className="font-normal">
              AI recommended "{wf.approval.ai_recommendation}"{wf.approval.overridden ? ' — overridden by the recruiter.' : '.'}
            </Text>
            {wf.approval.reason ? <Text className="mt-2">Reason: {wf.approval.reason}</Text> : null}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Agents" subtitle="Live state from the workflow engine. Tap a step for details." />
          <WorkflowTimeline
            spec={spec.data}
            nodes={d.nodes}
            summaries={derived.summaries}
            errors={derived.errors}
            currentState={wf.current_state}
            onSelect={setSelected}
          />
        </Card>

        {d.candidate ? (
          <Button
            title="Open candidate"
            icon={User}
            variant="secondary"
            onPress={() => router.push(`/dashboard/candidates/${d.candidate.id}`)}
            testID="open-candidate"
          />
        ) : null}
      </View>

      {selectedNode ? (
        <AgentDetailSheet spec={spec.data} node={selectedNode} output={d.state_output?.[selectedNode.name]} logs={d.logs} onClose={() => setSelected(null)} />
      ) : null}
    </Screen>
  );
}
