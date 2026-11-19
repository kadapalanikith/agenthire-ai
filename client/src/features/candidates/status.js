/** Display metadata for candidates.status values (server/src/constants/candidates.js). */
export const CANDIDATE_STATUS_META = {
  applied: { label: 'Applied', tone: 'neutral' },
  processing: { label: 'Screening', tone: 'primary' },
  awaiting_review: { label: 'Needs review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  failed: { label: 'Workflow failed', tone: 'danger' },
};

export const CANDIDATE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'applied', label: 'Applied' },
  { value: 'processing', label: 'Screening' },
  { value: 'awaiting_review', label: 'Needs review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'failed', label: 'Failed' },
];

/** workflows.status display (server/src/constants/workflow.js). */
export const WORKFLOW_STATUS_META = {
  pending: { label: 'Queued', tone: 'neutral' },
  running: { label: 'Running', tone: 'primary' },
  waiting_approval: { label: 'Waiting for approval', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
};
