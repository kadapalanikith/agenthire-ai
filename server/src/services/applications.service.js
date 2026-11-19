'use strict';

const crypto = require('node:crypto');
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Workflow = require('../models/Workflow');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { PUBLIC_STAGE_BY_STATUS } = require('../constants/candidates');
const { getSpec } = require('../utils/specLoader');
const { assertPdfBuffer } = require('../utils/pdfValidation');
const storage = require('./storage.service');
const { createPendingWorkflow, summarizeWorkflow } = require('./workflow.service');
const { logger } = require('../utils/logger');
const { getWorkflowRunner } = require('../workflows/runner');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/** Keep a display-safe original file name (never used as a path). */
function safeFileName(name) {
  const cleaned = String(name || 'resume.pdf')
    .replace(/[\\/:*?"<>|\0]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(-120);
  return cleaned || 'resume.pdf';
}

function alreadyApplied() {
  return new AppError(409, ERROR_CODES.ALREADY_APPLIED, 'You have already applied for this job with this email address');
}

/**
 * Public application: validate the job and PDF, store the file, create the
 * candidate and its pending workflow. On any failure, everything created so
 * far is removed so no orphan files or records remain.
 */
async function submitApplication({ fields, file }) {
  const job = await Job.findById(fields.job_id);
  if (!job) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Job not found');
  if (job.status !== 'open') throw new AppError(409, ERROR_CODES.JOB_CLOSED, 'This job is no longer accepting applications');

  assertPdfBuffer(file.buffer, { requireSignature: getSpec('system/upload-policy').resume.require_pdf_signature });

  if (await Candidate.exists({ job_id: job._id, email: fields.email })) throw alreadyApplied();

  const statusToken = crypto.randomBytes(32).toString('hex');
  let stored;
  let candidate;
  try {
    stored = await storage.saveResume(file.buffer);
    candidate = await Candidate.create({
      job_id: job._id,
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      resume_url: stored.key,
      resume_file: {
        original_name: safeFileName(file.originalname),
        size_bytes: stored.size_bytes,
        mime_type: 'application/pdf',
        sha256: stored.sha256,
      },
      status: 'applied',
      status_token_hash: hashToken(statusToken),
    });
    const workflow = await createPendingWorkflow({
      candidateId: candidate._id,
      jobId: job._id,
      workflowSpecId: job.workflow_spec_id,
    });
    candidate.workflow_id = workflow._id;
    await candidate.save();

    // Uploads always start the workflow automatically (no recruiter action).
    // If the engine is not initialised the workflow stays `pending` and is
    // started by boot recovery.
    const runner = getWorkflowRunner();
    if (runner) runner.enqueue(workflow._id);
    else logger.warn({ workflow_id: String(workflow._id) }, 'Workflow runner not initialised; workflow left pending');

    return {
      candidate_id: String(candidate._id),
      status_token: statusToken,
      status: candidate.status,
      stage: PUBLIC_STAGE_BY_STATUS[candidate.status],
      job: { id: String(job._id), title: job.title },
      workflow: summarizeWorkflow(workflow),
    };
  } catch (err) {
    // Compensate: remove partial state.
    if (candidate) {
      await Workflow.deleteOne({ candidate_id: candidate._id }).catch(() => {});
      await Candidate.deleteOne({ _id: candidate._id }).catch(() => {});
    }
    if (stored) {
      await storage.deleteResume(stored.key).catch((e) => logger.error({ err: e.message }, 'Failed to clean up resume file'));
    }
    if (err && err.code === 11000) throw alreadyApplied();
    throw err;
  }
}

/** Candidate-facing status: stage only, never scores or recommendations. */
async function getApplicationStatus(statusToken) {
  const candidate = await Candidate.findOne({ status_token_hash: hashToken(statusToken) });
  if (!candidate) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Application not found. Check that the link is complete.');
  const job = await Job.findById(candidate.job_id).select('title status');
  return {
    applicant_name: candidate.name.split(' ')[0],
    job: job ? { id: String(job._id), title: job.title } : null,
    stage: PUBLIC_STAGE_BY_STATUS[candidate.status],
    submitted_at: candidate.created_at,
    updated_at: candidate.updated_at,
  };
}

module.exports = { submitApplication, getApplicationStatus, safeFileName };
