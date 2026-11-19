'use strict';

const { StateGraph, START, END } = require('@langchain/langgraph');
const { HiringState } = require('./state');
const { withNodeLifecycle } = require('./nodeLifecycle');
const { createNodeHandlers } = require('./nodes');
const { isRetryableCode } = require('./errors');
const { getSpec } = require('../utils/specLoader');

/** LangGraph retry policy from specs/system/retry-policy.json. */
function buildRetryPolicy(overrides = {}) {
  const spec = { ...getSpec('system/retry-policy'), ...overrides };
  return {
    maxAttempts: spec.max_retries + 1,
    initialInterval: spec.retry_delay_ms,
    backoffFactor: spec.backoff_multiplier,
    jitter: false,
    logWarning: false,
    retryOn: (err) => Boolean(err && isRetryableCode(err.code)),
  };
}

/**
 * Build the hiring graph from specs/workflow/default-hiring-workflow.json:
 * nodes in spec order, linear edges, and the spec's branches after the
 * checkpoint node. Nothing about order is hardcoded here.
 */
function buildHiringGraph({ deps, checkpointer, retryOverrides, handlersOverride }) {
  const spec = getSpec('workflow/default-hiring-workflow');
  const retryPolicy = buildRetryPolicy(retryOverrides);
  const handlers = { ...createNodeHandlers(deps), ...(handlersOverride || {}) };
  const graph = new StateGraph(HiringState);

  for (const node of spec.workflow) {
    if (!handlers[node]) throw new Error(`No handler for workflow node "${node}"`);
    const isCheckpoint = spec.checkpoint_nodes.includes(node);
    graph.addNode(node, withNodeLifecycle(node, handlers[node], { maxAttempts: retryPolicy.maxAttempts }), {
      // Checkpoint nodes wait for a person; retrying them makes no sense.
      retryPolicy: isCheckpoint ? undefined : retryPolicy,
    });
  }

  graph.addEdge(START, spec.workflow[0]);
  spec.workflow.forEach((node, i) => {
    const branch = spec.branches[node];
    if (branch) {
      const targets = Object.fromEntries(Object.entries(branch).map(([decision, b]) => [decision, b.next]));
      graph.addConditionalEdges(node, (state) => state.approval?.decision, targets);
    } else {
      const next = spec.workflow[i + 1];
      // After a branch target that is not the last node, continue linearly.
      graph.addEdge(node, next || END);
    }
  });

  return graph.compile({ checkpointer });
}

module.exports = { buildHiringGraph, buildRetryPolicy };
