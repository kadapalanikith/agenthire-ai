import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, X } from 'lucide-react-native';
import { Badge, Button, Card, CardHeader, ChipList, ErrorState, InlineAlert, Screen, ScreenHeader, SegmentedControl, Skeleton, Text, TextField } from '../../../../../src/components/ui';
import { useApproveWorkflow, useWorkflow } from '../../../../../src/features/workflows/hooks';
import { RECOMMENDATION_META } from '../../../../../src/features/candidates/status';
import { MatchScore } from '../../../../../src/features/candidates/components/CandidateCard';

const DECISIONS = [
  { value: 'approve', label: 'Approve', Icon: Check },
  { value: 'reject', label: 'Reject', Icon: X },
];

/**
 * Human approval checkpoint. The AI output is advisory; the recruiter's
 * decision resumes the paused workflow. Whether a reason is required comes
 * from the server (spec-driven override rule).
 */
export default function ApprovalScreen() {
  const { workflowId } = useLocalSearchParams();
  const query = useWorkflow(workflowId);
  const approve = useApproveWorkflow(workflowId);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const backHref = `/dashboard/workflows/${workflowId}`;

  if (query.isPending) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref={backHref} />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader fallbackHref={backHref} />
        <ErrorState error={query.error} onRetry={query.refetch} />
      </Screen>
    );
  }

  const req = query.data.approval_request;
  if (!req) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Decision" fallbackHref={backHref} />
        <InlineAlert tone="info" title="No decision needed" message={`This workflow is ${query.data.workflow.status.replace('_', ' ')}; it is not waiting for approval.`} />
      </Screen>
    );
  }

  const rec = RECOMMENDATION_META[req.ai_recommendation];
  const reasonRequired = decision ? Boolean(req.reason_required?.[decision]) : false;
  const formError = approve.error && approve.error.code !== 'VALIDATION_ERROR' ? approve.error : null;

  const submit = async () => {
    setReasonError(null);
    if (!decision) return;
    const trimmed = reason.trim();
    if (reasonRequired && trimmed.length < req.reason_min_length) {
      setReasonError(`Overriding the AI recommendation needs a reason of at least ${req.reason_min_length} characters.`);
      return;
    }
    try {
      await approve.mutateAsync({ decision, reason: trimmed || undefined });
      router.replace(backHref);
    } catch (err) {
      if (err.code === 'VALIDATION_ERROR') setReasonError(err.message);
    }
  };

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Review and decide" subtitle={`${query.data.candidate?.name} · ${query.data.job?.title}`} fallbackHref={backHref} />
      <View className="gap-5">
        <Card testID="approval-summary">
          <CardHeader title="AI assessment" subtitle="Advisory only. You make the final decision." right={rec ? <Badge label={rec.label} tone={rec.tone} /> : null} />
          <View className="mb-2 flex-row items-center justify-between">
            <Text tone="muted">Match score</Text>
            <MatchScore score={req.match_score} />
          </View>
          {req.explanation ? (
            <Text tone="muted" className="mb-3">
              {req.explanation}
            </Text>
          ) : null}
          <Text variant="label" tone="muted" className="mb-1.5">
            Missing skills
          </Text>
          {req.missing_skills.length ? <ChipList items={req.missing_skills} /> : <Text tone="subtle">None</Text>}
        </Card>

        <Card className="gap-4">
          <Text variant="heading">Your decision</Text>
          <SegmentedControl options={DECISIONS} value={decision} onChange={(v) => { setDecision(v); setReasonError(null); }} testID="decision" />
          {decision ? (
            <TextField
              label={reasonRequired ? 'Reason (required: this overrides the AI recommendation)' : 'Reason (optional)'}
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={2000}
              placeholder="Record why you made this decision"
              error={reasonError}
              hint={reasonRequired ? `At least ${req.reason_min_length} characters. Stored with the decision.` : 'Stored with the decision.'}
              testID="decision-reason"
            />
          ) : (
            <Text variant="label" tone="muted" className="font-normal">
              Choose approve or reject. The workflow continues from where it paused.
            </Text>
          )}
          {formError ? <InlineAlert tone="error" message={formError.message} /> : null}
          <Button
            title={decision === 'reject' ? 'Reject candidate' : decision === 'approve' ? 'Approve candidate' : 'Choose a decision'}
            variant={decision === 'reject' ? 'danger' : 'primary'}
            disabled={!decision}
            loading={approve.isPending}
            onPress={submit}
            testID="submit-decision"
          />
        </Card>
      </View>
    </Screen>
  );
}
