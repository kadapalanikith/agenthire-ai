'use strict';

const mongoose = require('mongoose');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Workflow = require('../models/Workflow');
const { toOwnerView } = require('./jobs.service');
const { CANDIDATE_STATUSES } = require('../constants/candidates');
const { WORKFLOW_STATUSES } = require('../constants/workflow');

const RECENT_JOBS = 5;

function countsByStatus(rows, statuses) {
  const map = Object.fromEntries(statuses.map((s) => [s, 0]));
  for (const r of rows) map[r._id] = r.count;
  return map;
}

/** Recruiter dashboard summary, computed from the database for the signed-in recruiter. */
async function getSummary(user) {
  const jobIds = (await Job.find({ created_by: user._id }).select('_id')).map((j) => j._id);
  const groupByStatus = { $group: { _id: '$status', count: { $sum: 1 } } };

  const [jobCounts, recent, candidateCounts, workflowCounts] = await Promise.all([
    Job.aggregate([{ $match: { created_by: user._id } }, groupByStatus]),
    Job.find({ created_by: user._id }).sort({ created_at: -1, _id: -1 }).limit(RECENT_JOBS),
    Candidate.aggregate([{ $match: { job_id: { $in: jobIds } } }, groupByStatus]),
    Workflow.aggregate([{ $match: { job_id: { $in: jobIds } } }, groupByStatus]),
  ]);

  const jobs = countsByStatus(jobCounts, ['open', 'closed']);
  const candidates = countsByStatus(candidateCounts, CANDIDATE_STATUSES);
  const workflows = countsByStatus(workflowCounts, WORKFLOW_STATUSES);
  const workflowTotal = Object.values(workflows).reduce((a, b) => a + b, 0);

  return {
    jobs: { total: jobs.open + jobs.closed, open: jobs.open, closed: jobs.closed },
    candidates: { total: Object.values(candidates).reduce((a, b) => a + b, 0), by_status: candidates },
    workflows: {
      total: workflowTotal,
      by_status: workflows,
      // Includes failed workflows in the denominator; null when there are none.
      completion_rate: workflowTotal ? Math.round((workflows.completed / workflowTotal) * 1000) / 10 : null,
    },
    recent_jobs: recent.map(toOwnerView),
    generated_at: new Date().toISOString(),
  };
}

module.exports = { getSummary };
