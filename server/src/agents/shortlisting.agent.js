'use strict';

const { getSpec } = require('../utils/specLoader');
const { AgentError } = require('../workflows/errors');

const AGENT = 'shortlisting_agent';

/**
 * Shortlisting Agent: turns the match score into a RECOMMENDATION using
 * specs/evaluation/shortlisting-rules.json. No threshold is written in code.
 *
 * role_minimum_score_policy "stricter_only" (DECISION D7):
 *   effective min of the `applies_to` band = max(band.min_score, role minimum_score).
 * A role minimum can raise but never lower a threshold. The result is never
 * a final decision: every candidate goes to human approval.
 */
function runShortlistingAgent({ matchScore, requirements }) {
  const rules = getSpec('evaluation/shortlisting-rules');
  if (typeof matchScore !== 'number' || Number.isNaN(matchScore)) {
    throw new AgentError('INVALID_SCHEMA', 'Shortlisting requires a numeric match score');
  }
  const policy = rules.role_minimum_score_policy;
  const roleMinimum = requirements.minimum_score;

  const bands = rules.bands.map((band) => {
    const effective = band.decision === policy.applies_to && policy.mode === 'stricter_only' ? Math.max(band.min_score, roleMinimum) : band.min_score;
    return { decision: band.decision, min_score: band.min_score, effective_min_score: effective };
  });

  // Bands are ordered by descending min_score (validated by the spec loader).
  const applied = bands.find((b) => matchScore >= b.effective_min_score) || bands[bands.length - 1];

  return {
    decision: applied.decision,
    match_score: matchScore,
    applied_band: applied,
    thresholds: bands,
    role_minimum_score: roleMinimum,
    role_minimum_score_policy: policy.mode,
    role_minimum_applied: bands.some((b) => b.effective_min_score !== b.min_score),
    recommendation_only: rules.recommendation_only,
    requires_human_approval: rules.requires_human_approval,
    hiring_spec: requirements.hiring_spec,
    spec_version: rules._meta.version,
  };
}

module.exports = { runShortlistingAgent, AGENT };
