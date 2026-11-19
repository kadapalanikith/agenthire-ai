'use strict';

const jobsService = require('../services/jobs.service');
const { sendSuccess } = require('../utils/apiResponse');

async function create(req, res) {
  const job = await jobsService.createJob(req.user, req.body);
  return sendSuccess(res, { job }, { status: 201 });
}

async function list(req, res) {
  const { items, meta } = await jobsService.listJobs(req.validatedQuery, req.user);
  return sendSuccess(res, { jobs: items }, { meta });
}

async function get(req, res) {
  const result = await jobsService.getJob(req.params.id, req.user);
  return sendSuccess(res, result);
}

async function update(req, res) {
  const job = await jobsService.updateJob(req.params.id, req.user, req.body);
  return sendSuccess(res, { job });
}

module.exports = { create, list, get, update };
