'use strict';

const { z } = require('zod');
const { WORKFLOW_STATUSES } = require('../constants/workflow');
const { objectId, pagination } = require('./common.validators');

const listWorkflowsQuery = z.strictObject({
  ...pagination,
  status: z.enum(WORKFLOW_STATUSES).optional(),
  job_id: objectId.optional(),
});

const startWorkflowBody = z.strictObject({ candidate_id: objectId });

module.exports = { listWorkflowsQuery, startWorkflowBody };
