'use strict';

/**
 * Identifiers of the agent nodes implemented by the backend. These are
 * names only: the execution ORDER and branching come from
 * specs/workflow/default-hiring-workflow.json and are never hardcoded.
 */
const AGENT_NODES = Object.freeze([
  'resume_parser',
  'embedding_agent',
  'matching_agent',
  'shortlisting_agent',
  'human_approval',
  'interview_agent',
  'email_agent',
]);

/** Per-node execution states (also the workflow_logs.status enum plus `pending`). */
const NODE_STATUSES = Object.freeze(['pending', 'running', 'success', 'failed', 'waiting_approval', 'skipped']);

/** workflow_logs.status values (a node is never logged as `pending`). */
const WORKFLOW_LOG_STATUSES = Object.freeze(['running', 'success', 'failed', 'waiting_approval', 'skipped']);

/** workflows.status values (original spec, unchanged). */
const WORKFLOW_STATUSES = Object.freeze(['pending', 'running', 'waiting_approval', 'completed', 'failed']);

/** Possible AI recommendations (shortlisting decision names). */
const RECOMMENDATIONS = Object.freeze(['shortlisted', 'hold', 'rejected']);

/** Recruiter decisions at the human approval checkpoint. */
const APPROVAL_DECISIONS = Object.freeze(['approve', 'reject']);

module.exports = {
  AGENT_NODES,
  NODE_STATUSES,
  WORKFLOW_LOG_STATUSES,
  WORKFLOW_STATUSES,
  RECOMMENDATIONS,
  APPROVAL_DECISIONS,
};
