'use strict';

const mongoose = require('mongoose');
const Workflow = require('../models/Workflow');
const WorkflowLog = require('../models/WorkflowLog');
const Candidate = require('../models/Candidate');
const Job = require('../models/Job');
const { getSpec, getSpecVersions } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { ROLES } = require('../constants/roles');

/**
 * Create the persisted workflow record for a new application. Execution
 * order and the initial state of every node come from
 * specs/workflow/default-hiring-workflow.json.
 */
async function createPendingWorkflow({ candidateId, jobId, workflowSpecId }) {
  const spec = getSpec('workflow/default-hiring-workflow');
  if (workflowSpecId !== spec._meta.id) throw new Error(`Unknown workflow spec "${workflowSpecId}"`);

  const _id = new mongoose.Types.ObjectId();
  const nodeStates = Object.fromEntries(spec.workflow.map((node) => [node, { status: 'pending', attempts: 0 }]));
  return Workflow.create({
    _id,
    thread_id: String(_id),
    candidate_id: candidateId,
    job_id: jobId,
    workflow_spec_id: spec._meta.id,
    status: 'pending',
    current_state: null,
    execution_order: [...spec.workflow],
    node_states: nodeStates,
    spec_versions: { ...getSpecVersions() },
  });
}

/** Compact workflow view used in candidate payloads. */
function summarizeWorkflow(workflow) {
  if (!workflow) return null;
  return {
    id: String(workflow._id),
    status: workflow.status,
    current_state: workflow.current_state,
    retry_count: workflow.retry_count,
    updated_at: workflow.updated_at,
  };
}

async function visibleJobIds(user) {
  if (user.role === ROLES.ADMIN) return null;
  return (await Job.find({ created_by: user._id }).select('_id')).map((j) => j._id);
}

function notFound() {
  return new AppError(404, ERROR_CODES.NOT_FOUND, 'Workflow not found');
}

/** Node list in execution order, with state and display config from node-states.json. */
function orderedNodes(wf) {
  const json = wf.toJSON();
  return json.execution_order.map((name, index) => ({ name, index, ...(json.node_states[name] || { status: 'pending', attempts: 0 }) }));
}

async function listWorkflows({ page, limit, status, job_id: jobId }, user) {
  const allowed = await visibleJobIds(user);
  const filter = {};
  if (jobId) {
    if (allowed && !allowed.some((id) => String(id) === jobId)) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Job not found');
    filter.job_id = jobId;
  } else if (allowed) {
    filter.job_id = mongoose.trusted({ $in: allowed });
  }
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    Workflow.find(filter).sort({ updated_at: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Workflow.countDocuments(filter),
  ]);
  const candidates = await Candidate.find({ _id: mongoose.trusted({ $in: items.map((w) => w.candidate_id) }) }).select('name match_score ai_recommendation status');
  const jobs = await Job.find({ _id: mongoose.trusted({ $in: items.map((w) => w.job_id) }) }).select('title');
  const cById = new Map(candidates.map((c) => [String(c._id), c]));
  const jById = new Map(jobs.map((j) => [String(j._id), j]));

  return {
    items: items.map((wf) => {
      const c = cById.get(String(wf.candidate_id));
      const j = jById.get(String(wf.job_id));
      return {
        id: String(wf._id),
        status: wf.status,
        current_state: wf.current_state,
        retry_count: wf.retry_count,
        last_error: wf.last_error,
        created_at: wf.created_at,
        updated_at: wf.updated_at,
        nodes: orderedNodes(wf).map(({ name, status: s }) => ({ name, status: s })),
        candidate: c ? { id: String(c._id), name: c.name, match_score: c.match_score, ai_recommendation: c.ai_recommendation, status: c.status } : null,
        job: j ? { id: String(j._id), title: j.title } : null,
      };
    }),
    meta: { page, limit, total, total_pages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function loadAccessible(id, user) {
  const wf = await Workflow.findById(id);
  if (!wf) throw notFound();
  if (user.role !== ROLES.ADMIN) {
    const job = await Job.findById(wf.job_id).select('created_by');
    if (!job || String(job.created_by) !== String(user._id)) throw notFound();
  }
  return wf;
}

/** GET /workflow/:id — workflow, nodes in execution order, logs, and outputs. */
async function getWorkflowDetail(id, user) {
  const wf = await loadAccessible(id, user);
  const [logs, candidate, job] = await Promise.all([
    WorkflowLog.find({ workflow_id: wf._id }).sort({ created_at: 1, _id: 1 }),
    Candidate.findById(wf.candidate_id).select('name status match_score ai_recommendation'),
    Job.findById(wf.job_id).select('title'),
  ]);
  const json = wf.toJSON();
  return {
    workflow: {
      id: json.id,
      status: json.status,
      current_state: json.current_state,
      retry_count: json.retry_count,
      last_error: json.last_error,
      approval: json.approval,
      spec_versions: json.spec_versions,
      created_at: json.created_at,
      updated_at: json.updated_at,
    },
    execution_order: json.execution_order,
    nodes: orderedNodes(wf),
    state_output: json.state_output || {},
    logs: logs.map((l) => l.toJSON()),
    candidate: candidate ? { id: String(candidate._id), name: candidate.name, status: candidate.status, match_score: candidate.match_score, ai_recommendation: candidate.ai_recommendation } : null,
    job: job ? { id: String(job._id), title: job.title } : null,
  };
}

/**
 * POST /workflow/start — manually start a candidate's workflow. Only
 * `pending` workflows can be started (uploads start automatically; failed
 * runs use retry, Phase 6).
 */
async function startWorkflow(candidateId, user, runner) {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Candidate not found');
  const job = await Job.findById(candidate.job_id);
  if (user.role !== ROLES.ADMIN && (!job || String(job.created_by) !== String(user._id))) {
    throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Candidate not found');
  }
  let wf = candidate.workflow_id ? await Workflow.findById(candidate.workflow_id) : null;
  if (!wf) {
    wf = await createPendingWorkflow({ candidateId: candidate._id, jobId: job._id, workflowSpecId: job.workflow_spec_id });
    candidate.workflow_id = wf._id;
    await candidate.save();
  }
  if (wf.status !== 'pending') {
    throw new AppError(409, ERROR_CODES.WORKFLOW_STATE_CONFLICT, `Workflow is ${wf.status}; only pending workflows can be started`);
  }
  if (!runner) throw new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, 'The workflow engine is not running');
  runner.enqueue(wf._id);
  return summarizeWorkflow(wf);
}

module.exports = { createPendingWorkflow, summarizeWorkflow, listWorkflows, getWorkflowDetail, startWorkflow };
