'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { logger } = require('./logger');

const LOG_FILE = path.resolve(__dirname, '../../logs/workflow-failures.log');

/**
 * Original spec: "Every failure must log the agent name, workflow state,
 * stack trace, and timestamp." Written as JSON lines to
 * server/logs/workflow-failures.log (gitignored) and to the app logger.
 * Never includes resume text, contact details or credentials.
 */
function logWorkflowFailure({ workflowId, agentName, workflowState, error, attempt, retryable, final }) {
  const entry = {
    timestamp: new Date().toISOString(),
    workflow_id: String(workflowId),
    agent_name: agentName,
    attempt,
    final,
    workflow_state: workflowState,
    error: { code: error?.code || 'UNKNOWN', message: error?.message || String(error), retryable, stack: error?.stack || null },
  };
  logger.error({ workflow_id: entry.workflow_id, agent: agentName, code: entry.error.code, attempt, final }, 'Workflow node failed');
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    fs.appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, 'utf8');
  } catch (err) {
    logger.error({ err: err.message }, 'Could not write workflow failure log');
  }
  return entry;
}

module.exports = { logWorkflowFailure, LOG_FILE };
