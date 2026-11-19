import { View } from 'react-native';
import { Badge, Card, CardHeader, ChipList, Text } from '../../../components/ui';
import { cn } from '../../../lib/cn';
import { RECOMMENDATION_META, WORKFLOW_STATUS_META } from '../status';
import { MatchScore } from './CandidateCard';

function BreakdownRow({ label, part, detail }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <View className="flex-1">
        <Text>{label}</Text>
        <Text variant="caption" tone="muted">
          {detail}
        </Text>
      </View>
      <Text className="font-semibold">{part.points}</Text>
    </View>
  );
}

function Section({ title, children, last }) {
  return (
    <View className={cn('gap-2 py-3', !last && 'border-b border-border')}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Explainable AI screening from the workflow (GET /candidates/:id → screening).
 * Shows only what the agents actually produced; nothing is estimated client-side.
 */
export function ScreeningCard({ candidate }) {
  const { workflow, screening } = candidate;
  const wfMeta = workflow ? WORKFLOW_STATUS_META[workflow.status] : null;
  const matching = screening?.matching;
  const shortlisting = screening?.shortlisting;
  const rec = shortlisting ? RECOMMENDATION_META[shortlisting.decision] : null;

  return (
    <Card testID="screening-card">
      <CardHeader
        title="AI screening"
        subtitle={workflow?.current_state && workflow.status === 'running' ? `Running: ${workflow.current_state.replace(/_/g, ' ')}` : undefined}
        right={wfMeta ? <Badge label={wfMeta.label} tone={wfMeta.tone} /> : null}
      />

      {!matching ? (
        <Text variant="label" tone="muted" className="font-normal" testID="screening-pending">
          {workflow?.status === 'failed'
            ? 'Screening stopped because of an error. See the workflow for details.'
            : workflow?.status === 'pending'
              ? 'The application is stored and queued. No AI screening results exist yet.'
              : 'Screening is in progress. Results appear here as each agent finishes.'}
        </Text>
      ) : (
        <View>
          <View className="flex-row items-end justify-between border-b border-border pb-3">
            <View className="gap-1">
              <Text variant="caption" tone="muted">
                Match score
              </Text>
              <MatchScore score={matching.match_score} />
            </View>
            {rec ? (
              <View className="items-end gap-1">
                <Text variant="caption" tone="muted">
                  AI recommendation
                </Text>
                <Badge label={rec.label} tone={rec.tone} testID="ai-recommendation" />
              </View>
            ) : null}
          </View>

          {shortlisting ? (
            <Text variant="caption" tone="subtle" className="pt-2" testID="recommendation-note">
              Recommendation only. You make the final decision.
              {` Band: ${shortlisting.applied_band.decision} (≥ ${shortlisting.applied_band.effective_min_score}), rules v${shortlisting.spec_version}.`}
            </Text>
          ) : null}

          <Section title="Score breakdown">
            <BreakdownRow
              label="Required skills"
              part={matching.score_breakdown.required}
              detail={`${matching.score_breakdown.required.matched} of ${matching.score_breakdown.required.total} · weight ${matching.score_breakdown.weights.required_skills}`}
            />
            <BreakdownRow
              label="Preferred skills"
              part={matching.score_breakdown.preferred}
              detail={`${matching.score_breakdown.preferred.matched} of ${matching.score_breakdown.preferred.total} · weight ${matching.score_breakdown.weights.preferred_skills}`}
            />
            <BreakdownRow
              label="Experience"
              part={matching.score_breakdown.experience}
              detail={`${matching.score_breakdown.experience.candidate_years ?? 'unknown'} yrs vs ${matching.score_breakdown.experience.minimum} min · weight ${matching.score_breakdown.weights.experience}`}
            />
          </Section>

          <Section title="Matched skills">
            {[...matching.matched_required_skills, ...matching.matched_preferred_skills].length ? (
              <ChipList items={[...matching.matched_required_skills, ...matching.matched_preferred_skills]} tone="primary" testID="matched-skills" />
            ) : (
              <Text tone="subtle">None</Text>
            )}
          </Section>

          <Section title="Missing skills">
            {matching.missing_skills.length ? <ChipList items={matching.missing_skills} testID="missing-skills" /> : <Text tone="subtle">None</Text>}
          </Section>

          <Section title="Explanation">
            <Text tone="muted" testID="match-explanation">
              {matching.explanation}
            </Text>
          </Section>

          <Section title="Evidence from the resume" last>
            {matching.evidence.filter((e) => e.quote).length ? (
              matching.evidence
                .filter((e) => e.quote)
                .map((e) => (
                  <View key={e.skill} className="gap-0.5">
                    <Text variant="label">{e.skill}</Text>
                    <Text variant="caption" tone="muted">
                      “{e.quote}”{e.source === 'llm_verified_quote' ? ' · AI-found, verified' : ''}
                    </Text>
                  </View>
                ))
            ) : (
              <Text tone="subtle">No quotes recorded</Text>
            )}
          </Section>
        </View>
      )}
    </Card>
  );
}
