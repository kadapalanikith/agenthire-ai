'use strict';

const rateLimit = require('express-rate-limit');
const { getSpec } = require('../utils/specLoader');
const { errorBody } = require('../utils/apiResponse');
const { ERROR_CODES } = require('../constants/errorCodes');

function build({ window_ms: windowMs, max }) {
  return rateLimit({
    windowMs,
    limit: max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json(errorBody(ERROR_CODES.RATE_LIMITED, 'Too many requests. Please try again later.')),
  });
}

/**
 * Create the limiters from specs/system/auth-policy.json. `overrides` lets
 * tests shrink windows; production always uses the spec values.
 */
function createRateLimiters(overrides = {}) {
  const limits = {
    ...getSpec('system/auth-policy').rate_limits,
    ...getSpec('system/upload-policy').rate_limits,
    ...overrides,
  };
  return {
    general: build(limits.general),
    auth: build(limits.auth),
    passwordReset: build(limits.password_reset),
    applicationUpload: build(limits.application_upload),
    applicationStatus: build(limits.application_status),
  };
}

module.exports = { createRateLimiters };
