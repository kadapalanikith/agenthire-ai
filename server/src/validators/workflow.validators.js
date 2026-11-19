'use strict';

const { z } = require('zod');
const { WORKFLOW_STATUSES, APPROVAL_DECISIONS } = require('../constants/workflow');
const { objectId, pagination } = require('./common.validators');

const listWorkflowsQuery = z.strictObject({
  ...pagination,
  status: z.enum(WORKFLOW_STATUSES).optional(),
  job_id: objectId.optional(),
});

const startWorkflowBody = z.strictObject({ candidate_id: objectId });

const approveWorkflowBody = z.strictObject({
  workflow_id: objectId,
  decision: z.enum(APPROVAL_DECISIONS, { error: 'Decision must be "approve" or "reject"' }),
  // The override-reason rule (length, when required) comes from the specs and is checked in the service.
  reason: z.string().trim().max(2000).optional(),
});

const retryWorkflowBody = z.strictObject({ workflow_id: objectId });

module.exports = { listWorkflowsQuery, startWorkflowBody, approveWorkflowBody, retryWorkflowBody };
