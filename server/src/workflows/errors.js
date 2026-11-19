'use strict';

const { getSpec } = require('../utils/specLoader');

/**
 * Errors raised by agents. Whether an error is retried is decided by
 * specs/system/retry-policy.json, never by the throwing code.
 */
class AgentError extends Error {
  constructor(code, message, { cause, details } = {}) {
    super(message);
    this.name = 'AgentError';
    this.code = code;
    if (cause) this.cause = cause;
    if (details !== undefined) this.details = details;
  }

  get retryable() {
    return isRetryableCode(this.code);
  }
}

function isRetryableCode(code) {
  const policy = getSpec('system/retry-policy');
  if (policy.retryable_errors.includes(code)) return true;
  return false;
}

/** Codes not listed anywhere in the policy are treated as non-retryable. */
function classifyError(err) {
  const code = err && err.code ? err.code : 'UNKNOWN';
  return { code, retryable: isRetryableCode(code) };
}

module.exports = { AgentError, classifyError, isRetryableCode };
