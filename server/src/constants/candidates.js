'use strict';

/**
 * candidates.status lifecycle:
 *   applied → processing → awaiting_review → approved | rejected
 *   (failed when the workflow fails; a recruiter can retry)
 */
const CANDIDATE_STATUSES = Object.freeze(['applied', 'processing', 'awaiting_review', 'approved', 'rejected', 'failed']);

/**
 * Stage shown to candidates on the public status page. Scores and AI
 * recommendations are never exposed to candidates.
 */
const PUBLIC_STAGE_BY_STATUS = Object.freeze({
  applied: 'received',
  processing: 'in_review',
  awaiting_review: 'in_review',
  failed: 'in_review',
  approved: 'decision_made',
  rejected: 'decision_made',
});

const CANDIDATE_LIMITS = Object.freeze({ NAME_MIN: 2, NAME_MAX: 100, PHONE_MIN_DIGITS: 7, PHONE_MAX_DIGITS: 15 });

module.exports = { CANDIDATE_STATUSES, PUBLIC_STAGE_BY_STATUS, CANDIDATE_LIMITS };
