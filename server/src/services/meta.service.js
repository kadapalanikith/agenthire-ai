'use strict';

const { getSpec, getHiringSpec, listHiringSpecs } = require('../utils/specLoader');

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

/** Base role specs a recruiter can build a job from. */
function getHiringSpecs() {
  return listHiringSpecs().map(({ id }) => {
    const s = getHiringSpec(id);
    return {
      id,
      version: s._meta.version,
      role: s.role,
      required_skills: s.required_skills,
      preferred_skills: s.preferred_skills,
      minimum_score: s.minimum_score,
      interview_rounds: s.interview_rounds,
    };
  });
}

/** Public upload rules so the apply form validates files before uploading. */
function getUploadPolicy() {
  const policy = getSpec('system/upload-policy');
  return {
    version: policy._meta.version,
    max_size_bytes: policy.resume.max_size_bytes,
    allowed_mime_types: policy.resume.allowed_mime_types,
    allowed_extensions: policy.resume.allowed_extensions,
  };
}

module.exports = { getWorkflowSpec, getAuthPolicy, getHiringSpecs, getUploadPolicy };
