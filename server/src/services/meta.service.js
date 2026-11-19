'use strict';

const { getSpec } = require('../utils/specLoader');

/** Workflow order, branches and node-state display config for the client. */
function getWorkflowSpec() {
  const workflow = getSpec('workflow/default-hiring-workflow');
  const nodeStates = getSpec('workflow/node-states');
  return {
    id: workflow._meta.id,
    version: workflow._meta.version,
    workflow: workflow.workflow,
    checkpoint_nodes: workflow.checkpoint_nodes,
    branches: workflow.branches,
    node_states: nodeStates.states,
    node_states_version: nodeStates._meta.version,
  };
}

/** Public password rules, so the client mirrors server validation without hardcoding it. */
function getAuthPolicy() {
  const policy = getSpec('system/auth-policy');
  return { version: policy._meta.version, password: policy.password };
}

module.exports = { getWorkflowSpec, getAuthPolicy };
