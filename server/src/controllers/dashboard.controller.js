'use strict';

const dashboardService = require('../services/dashboard.service');
const metaService = require('../services/meta.service');
const { sendSuccess } = require('../utils/apiResponse');

async function summary(req, res) {
  return sendSuccess(res, await dashboardService.getSummary(req.user));
}

async function hiringSpecs(_req, res) {
  return sendSuccess(res, { hiring_specs: metaService.getHiringSpecs() });
}

module.exports = { summary, hiringSpecs };
