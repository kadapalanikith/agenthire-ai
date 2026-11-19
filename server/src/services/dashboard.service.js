'use strict';

const Job = require('../models/Job');
const { toOwnerView } = require('./jobs.service');

const RECENT_JOBS = 5;

/**
 * Recruiter dashboard summary computed from the database. Candidate and
 * workflow figures are added when those collections exist (Phases 3–6).
 */
async function getSummary(user) {
  const [counts, recent] = await Promise.all([
    Job.aggregate([{ $match: { created_by: user._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Job.find({ created_by: user._id }).sort({ created_at: -1, _id: -1 }).limit(RECENT_JOBS),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.count]));
  const open = byStatus.open || 0;
  const closed = byStatus.closed || 0;
  return {
    jobs: { total: open + closed, open, closed },
    recent_jobs: recent.map(toOwnerView),
    generated_at: new Date().toISOString(),
  };
}

module.exports = { getSummary };
