'use strict';

const workflowService = require('../services/workflow.service');
const { getWorkflowRunner } = require('../workflows/runner');
const { sendSuccess } = require('../utils/apiResponse');

async function list(req, res) {
  const { items, meta } = await workflowService.listWorkflows(req.validatedQuery, req.user);
  return sendSuccess(res, { workflows: items }, { meta });
}

async function get(req, res) {
  return sendSuccess(res, await workflowService.getWorkflowDetail(req.params.id, req.user));
}

async function start(req, res) {
  const workflow = await workflowService.startWorkflow(req.body.candidate_id, req.user, getWorkflowRunner());
  return sendSuccess(res, { workflow }, { status: 202 });
}

module.exports = { list, get, start };
