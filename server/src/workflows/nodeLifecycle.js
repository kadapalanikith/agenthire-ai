'use strict';

const { isGraphInterrupt } = require('@langchain/langgraph');
const Workflow = require('../models/Workflow');
const WorkflowLog = require('../models/WorkflowLog');
const { classifyError } = require('./errors');
const { logWorkflowFailure } = require('../utils/workflowFailureLogger');

/**
 * Wrap an agent node so every attempt is persisted: workflow current_state
 * and per-node state, a workflow_logs entry (running → success / failed /
 * waiting_approval), duration, and a structured failure log. Errors are
 * re-thrown so LangGraph's retry policy can act on them.
 *
 * handler(state) must resolve { update, output, input? }:
 *   update → LangGraph state update; output → stored in logs/state_output.
 */
// Attempts within one runner execution (LangGraph's retry loop counts per
// invocation; node_states.attempts keeps the lifetime total for history).
const runAttempts = new Map();

function nextRunAttempt(runId, workflowId, agentName) {
  const key = `${runId || 'no-run'}:${workflowId}:${agentName}`;
  const n = (runAttempts.get(key) || 0) + 1;
  runAttempts.set(key, n);
  return n;
}

function clearRunAttempts(runId) {
  for (const key of runAttempts.keys()) if (key.startsWith(`${runId}:`)) runAttempts.delete(key);
}

function withNodeLifecycle(agentName, handler, { maxAttempts, isCheckpoint = false }) {
  return async function lifecycleNode(state, config) {
    const workflowId = state.workflow_id;
    const runAttempt = nextRunAttempt(config?.configurable?.run_id, workflowId, agentName);
    const startedAt = new Date();
    const wf = await Workflow.findByIdAndUpdate(
      workflowId,
      {
        $set: {
          status: 'running',
          current_state: agentName,
          [`node_states.${agentName}.status`]: 'running',
          [`node_states.${agentName}.started_at`]: startedAt,
          [`node_states.${agentName}.completed_at`]: null,
        },
        // A checkpoint node is re-entered by LangGraph when it resumes; that is
        // the same step continuing, not a new attempt.
        ...(isCheckpoint ? { $max: { [`node_states.${agentName}.attempts`]: 1 } } : { $inc: { [`node_states.${agentName}.attempts`]: 1 } }),
      },
      { returnDocument: 'after' }
    );
    if (!wf) throw Object.assign(new Error(`Workflow ${workflowId} not found`), { code: 'INVALID_SCHEMA' });
    const attempt = wf.node_states.get(agentName)?.attempts ?? 1;
    const log = await WorkflowLog.create({ workflow_id: workflowId, agent_name: agentName, status: 'running', attempt });

    const finish = async (status, fields, nodeFields) => {
      const completedAt = new Date();
      const durationMs = completedAt - startedAt;
      await WorkflowLog.updateOne({ _id: log._id }, { $set: { status, duration_ms: durationMs, completed_at: completedAt, ...fields } });
      await Workflow.updateOne(
        { _id: workflowId },
        {
          $set: {
            [`node_states.${agentName}.status`]: status,
            [`node_states.${agentName}.completed_at`]: status === 'waiting_approval' ? null : completedAt,
            [`node_states.${agentName}.duration_ms`]: durationMs,
            ...nodeFields,
          },
        }
      );
    };

    try {
      const { update, output, input } = await handler(state, { attempt });
      await finish('success', { output: output ?? null, input: input ?? null }, { [`state_output.${agentName}`]: output ?? null });
      return update;
    } catch (err) {
      if (isGraphInterrupt(err)) {
        // Pause point (human approval). Not a failure.
        await finish('waiting_approval', { output: { interrupted: true } }, {});
        throw err;
      }
      const { code, retryable } = classifyError(err);
      const final = !retryable || runAttempt >= maxAttempts;
      await finish(
        'failed',
        { error: { code, message: err.message, retryable, stack: err.stack } },
        final ? {} : { [`node_states.${agentName}.status`]: 'running' }
      );
      logWorkflowFailure({
        workflowId,
        agentName,
        attempt,
        retryable,
        final,
        workflowState: { status: 'running', current_state: agentName },
        error: err,
      });
      throw err;
    }
  };
}

module.exports = { withNodeLifecycle, clearRunAttempts };
