'use strict';

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const Workflow = require('../models/Workflow');
const { getEnv } = require('../config/env');
const { getSpec } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { ROLES } = require('../constants/roles');
const storage = require('./storage.service');
const { summarizeWorkflow } = require('./workflow.service');

const RESUME_AUDIENCE = 'agenthire-resume';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function notFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, 'Candidate not found');
}

/** Ids of jobs whose candidates the user may see (admins: all). */
async function visibleJobIds(user) {
  if (user.role === ROLES.ADMIN) return null;
  const jobs = await Job.find({ created_by: user._id }).select('_id');
  return jobs.map((j) => j._id);
}

function toCandidateView(candidate, job, workflow) {
  return {
    ...candidate.toJSON(),
    job: job ? { id: String(job._id), title: job.title, status: job.status } : null,
    workflow: summarizeWorkflow(workflow),
  };
}

async function listCandidates({ page, limit, job_id: jobId, status, q }, user) {
  const allowed = await visibleJobIds(user);
  const filter = {};
  if (jobId) {
    if (allowed && !allowed.some((id) => String(id) === jobId)) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Job not found');
    }
    filter.job_id = jobId;
  } else if (allowed) {
    // Operators built here are trusted; user input is never spread into filters.
    filter.job_id = mongoose.trusted({ $in: allowed });
  }
  if (status) filter.status = status;
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: re }, { email: re }];
  }

  const [items, total] = await Promise.all([
    Candidate.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Candidate.countDocuments(filter),
  ]);

  const jobIds = [...new Set(items.map((c) => String(c.job_id)))];
  const workflowIds = items.map((c) => c.workflow_id).filter(Boolean);
  const [jobs, workflows] = await Promise.all([
    Job.find({ _id: mongoose.trusted({ $in: jobIds }) }).select('title status'),
    Workflow.find({ _id: mongoose.trusted({ $in: workflowIds }) }).select('status current_state retry_count updated_at'),
  ]);
  const jobById = new Map(jobs.map((j) => [String(j._id), j]));
  const wfById = new Map(workflows.map((w) => [String(w._id), w]));

  return {
    items: items.map((c) => toCandidateView(c, jobById.get(String(c.job_id)), wfById.get(String(c.workflow_id)))),
    meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

/** Load a candidate the user may access; 404 otherwise (do not reveal existence). */
async function loadAccessibleCandidate(id, user) {
  const candidate = await Candidate.findById(id).select('+resume_url');
  if (!candidate) throw notFound();
  const job = await Job.findById(candidate.job_id);
  if (user.role !== ROLES.ADMIN && (!job || String(job.created_by) !== String(user._id))) throw notFound();
  return { candidate, job };
}

async function getCandidate(id, user) {
  const { candidate, job } = await loadAccessibleCandidate(id, user);
  const workflow = candidate.workflow_id ? await Workflow.findById(candidate.workflow_id) : null;
  return toCandidateView(candidate, job, workflow);
}

/**
 * Short-lived signed link so a browser / in-app viewer can open the PDF
 * without an Authorization header. The path is relative to the API base URL.
 */
async function createResumeLink(id, user) {
  const { candidate } = await loadAccessibleCandidate(id, user);
  const ttl = getSpec('system/upload-policy').resume_access_link_ttl_seconds;
  const access = jwt.sign({ purpose: 'resume' }, getEnv().JWT_SECRET, {
    subject: String(candidate._id),
    audience: RESUME_AUDIENCE,
    issuer: 'agenthire',
    expiresIn: ttl,
    algorithm: 'HS256',
  });
  return {
    path: `/candidates/${candidate._id}/resume?access=${encodeURIComponent(access)}`,
    expires_at: new Date(Date.now() + ttl * 1000).toISOString(),
  };
}

function verifyResumeAccess(token, candidateId) {
  try {
    const payload = jwt.verify(token, getEnv().JWT_SECRET, {
      algorithms: ['HS256'],
      audience: RESUME_AUDIENCE,
      issuer: 'agenthire',
    });
    return payload.purpose === 'resume' && payload.sub === candidateId;
  } catch {
    return false;
  }
}

/** Resolve the stored PDF for a recruiter (user) or a signed access token. */
async function getResumeFile(id, { user, access }) {
  let candidate;
  if (access) {
    if (!verifyResumeAccess(access, id)) throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'This resume link is invalid or has expired');
    candidate = await Candidate.findById(id).select('+resume_url');
    if (!candidate) throw notFound();
  } else {
    ({ candidate } = await loadAccessibleCandidate(id, user));
  }
  if (!(await storage.resumeExists(candidate.resume_url))) {
    throw new AppError(404, ERROR_CODES.RESUME_UNAVAILABLE, 'The resume file is no longer available');
  }
  return {
    stream: storage.openResumeStream(candidate.resume_url),
    size: candidate.resume_file.size_bytes,
    filename: candidate.resume_file.original_name,
  };
}

module.exports = { listCandidates, getCandidate, createResumeLink, getResumeFile, verifyResumeAccess, visibleJobIds };
