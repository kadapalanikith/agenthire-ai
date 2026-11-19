'use strict';

const Job = require('../models/Job');
const { getEnv } = require('../config/env');
const { getHiringSpec, getSpec } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { ROLES } = require('../constants/roles');

const PUBLIC_FIELDS = ['title', 'description', 'required_skills', 'preferred_skills', 'min_experience', 'status', 'created_at'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Shareable links. Built from PUBLIC_WEB_URL so the client never hardcodes hosts. */
function buildLinks(jobId) {
  const base = getEnv().PUBLIC_WEB_URL.replace(/\/+$/, '');
  return { public_url: `${base}/jobs/${jobId}`, apply_url: `${base}/jobs/${jobId}/apply` };
}

function canManage(job, user) {
  if (!user) return false;
  return user.role === ROLES.ADMIN || String(job.created_by) === String(user._id);
}

function toOwnerView(job) {
  const json = job.toJSON();
  const hiring = getHiringSpec(json.hiring_spec_id);
  return {
    ...json,
    ...buildLinks(json.id),
    hiring_spec: hiring ? { id: hiring._meta.id, role: hiring.role, version: hiring._meta.version } : null,
  };
}

function toPublicView(job) {
  const json = job.toJSON();
  const view = { id: json.id };
  for (const f of PUBLIC_FIELDS) view[f] = json[f];
  return { ...view, ...buildLinks(json.id) };
}

function validationError(path, message) {
  return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', [{ path, message, location: 'body' }]);
}

/** Every job must point at specs that exist in /specs. */
function resolveSpecRefs({ hiring_spec_id: hiringId, workflow_spec_id: workflowId }) {
  const out = {};
  if (hiringId !== undefined) {
    if (!getHiringSpec(hiringId)) throw validationError('hiring_spec_id', `Unknown hiring spec "${hiringId}"`);
    out.hiring_spec_id = hiringId;
  }
  const knownWorkflow = getSpec('workflow/default-hiring-workflow')._meta.id;
  if (workflowId !== undefined && workflowId !== knownWorkflow) {
    throw validationError('workflow_spec_id', `Unknown workflow spec "${workflowId}"`);
  }
  if (workflowId !== undefined) out.workflow_spec_id = workflowId;
  return { out, knownWorkflow };
}

async function createJob(user, input) {
  const { out, knownWorkflow } = resolveSpecRefs(input);
  const job = await Job.create({
    title: input.title,
    description: input.description,
    required_skills: input.required_skills,
    preferred_skills: input.preferred_skills,
    min_experience: input.min_experience,
    hiring_spec_id: out.hiring_spec_id,
    workflow_spec_id: out.workflow_spec_id || knownWorkflow,
    created_by: user._id,
    status: 'open',
  });
  return toOwnerView(job);
}

/**
 * scope=public: open jobs from every recruiter, public fields only.
 * scope=mine:   the signed-in recruiter's jobs (any status), full fields.
 */
async function listJobs({ scope, status, q, page, limit }, user) {
  const filter = {};
  if (scope === 'mine') {
    if (!user) throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Sign in to list your jobs');
    filter.created_by = user._id;
    if (status) filter.status = status;
  } else {
    filter.status = 'open';
  }
  if (q) filter.title = new RegExp(escapeRegex(q), 'i');

  const [items, total] = await Promise.all([
    Job.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Job.countDocuments(filter),
  ]);

  return {
    items: items.map(scope === 'mine' ? toOwnerView : toPublicView),
    meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function findJobOr404(id) {
  const job = await Job.findById(id);
  if (!job) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Job not found');
  return job;
}

/** Owners and admins get the full record; everyone else gets the public view. */
async function getJob(id, user) {
  const job = await findJobOr404(id);
  return canManage(job, user) ? { job: toOwnerView(job), can_manage: true } : { job: toPublicView(job), can_manage: false };
}

async function updateJob(id, user, input) {
  const job = await findJobOr404(id);
  if (!canManage(job, user)) throw new AppError(403, ERROR_CODES.FORBIDDEN, 'You can only edit jobs you created');

  const { out } = resolveSpecRefs(input);
  const merged = {
    required_skills: input.required_skills ?? job.required_skills,
    preferred_skills: input.preferred_skills ?? job.preferred_skills,
  };
  const required = new Set(merged.required_skills.map((s) => s.toLowerCase()));
  const overlap = merged.preferred_skills.filter((s) => required.has(s.toLowerCase()));
  if (overlap.length) throw validationError('preferred_skills', `Already listed as required: ${overlap.join(', ')}`);

  for (const field of ['title', 'description', 'required_skills', 'preferred_skills', 'min_experience', 'status']) {
    if (input[field] !== undefined) job[field] = input[field];
  }
  Object.assign(job, out);
  await job.save();
  return toOwnerView(job);
}

module.exports = { createJob, listJobs, getJob, updateJob, buildLinks, canManage, toOwnerView, toPublicView };
