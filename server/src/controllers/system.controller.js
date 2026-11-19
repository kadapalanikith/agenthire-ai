'use strict';

const { getHealth } = require('../services/health.service');
const metaService = require('../services/meta.service');
const { sendSuccess } = require('../utils/apiResponse');

async function health(_req, res) {
  const report = await getHealth();
  return sendSuccess(res, report, { status: report.status === 'down' ? 503 : 200 });
}

async function workflowSpec(_req, res) {
  return sendSuccess(res, metaService.getWorkflowSpec());
}

async function authPolicy(_req, res) {
  return sendSuccess(res, metaService.getAuthPolicy());
}

module.exports = { health, workflowSpec, authPolicy };
