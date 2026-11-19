'use strict';

const { z } = require('zod');
const { getSpec } = require('../utils/specLoader');
const { AgentError } = require('../workflows/errors');
const { APPROVAL_DECISIONS } = require('../constants/workflow');

const AGENT = 'human_approval';

/**
 * Payload shown to the recruiter when the workflow pauses. Contains the AI
 * recommendation and its explanation; the decision is always human.
 */
function buildApprovalRequest({ recommendation, matchResult }) {
  return {
    type: 'human_approval',
    ai_recommendation: recommendation.decision,
    match_score: recommendation.match_score,
    applied_band: recommendation.applied_band,
    explanation: matchResult?.explanation ?? null,
    missing_skills: matchResult?.missing_skills ?? [],
  };
}

const decisionSchema = z.object({
  decision: z.enum(APPROVAL_DECISIONS),
  reason: z.string().trim().max(2000).nullable().optional(),
  decided_by: z.string().regex(/^[a-f0-9]{24}$/),
  decided_at: z.string().datetime(),
});

/** An override is approving a "rejected" or rejecting a "shortlisted" recommendation. */
function isOverride(decision, aiRecommendation) {
  return (decision === 'approve' && aiRecommendation === 'rejected') || (decision === 'reject' && aiRecommendation === 'shortlisted');
}

/**
 * Validate the recruiter decision supplied when the workflow resumes. The
 * API layer checks this too; this re-check protects the graph itself.
 */
function resolveApproval(resumeValue, recommendation) {
  const parsed = decisionSchema.safeParse(resumeValue);
  if (!parsed.success) throw new AgentError('INVALID_SCHEMA', 'Invalid human approval decision');
  const { decision, reason, decided_by: decidedBy, decided_at: decidedAt } = parsed.data;
  const rules = getSpec('evaluation/shortlisting-rules');
  const fairness = getSpec('evaluation/fairness-policy');
  const overridden = isOverride(decision, recommendation.decision);
  if (overridden && rules.override_requires_reason && (!reason || reason.length < fairness.override_reason_min_length)) {
    throw new AgentError('INVALID_SCHEMA', `Overriding the AI recommendation requires a reason of at least ${fairness.override_reason_min_length} characters`);
  }
  return { decision, reason: reason || null, ai_recommendation: recommendation.decision, overridden, decided_by: decidedBy, decided_at: decidedAt };
}

module.exports = { buildApprovalRequest, resolveApproval, isOverride, AGENT };
