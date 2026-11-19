'use strict';

const { getHiringSpec } = require('./specLoader');

/**
 * Merge the job document with its base hiring spec. Skills and minimum
 * experience always come from the JOB (job-specific matching); the role
 * minimum_score and interview_rounds come from the hiring spec.
 */
function mergeJobRequirements(job) {
  const hiring = getHiringSpec(job.hiring_spec_id);
  if (!hiring) throw new Error(`Job ${job._id || job.id} references unknown hiring spec "${job.hiring_spec_id}"`);
  return {
    job_id: String(job._id || job.id),
    title: job.title,
    role: hiring.role,
    required_skills: [...job.required_skills],
    preferred_skills: [...(job.preferred_skills || [])],
    min_experience: job.min_experience,
    minimum_score: hiring.minimum_score,
    interview_rounds: hiring.interview_rounds,
    hiring_spec: { id: hiring._meta.id, version: hiring._meta.version },
  };
}

module.exports = { mergeJobRequirements };
