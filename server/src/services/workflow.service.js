'use strict';

const mongoose = require('mongoose');
const Workflow = require('../models/Workflow');
const { getSpec, getSpecVersions } = require('../utils/specLoader');

/**
 * Create the persisted workflow record for a new application. Execution
 * order and the initial state of every node come from
 * specs/workflow/default-hiring-workflow.json. Execution itself (LangGraph)
 * is wired in Phase 5; until then the record honestly stays `pending`.
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

module.exports = { createPendingWorkflow, summarizeWorkflow };
