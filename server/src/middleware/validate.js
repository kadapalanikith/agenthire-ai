'use strict';

const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');

function formatIssues(issues) {
  return issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
}

/**
 * Validate req.body / req.params / req.query with Zod schemas.
 * Parsed (typed, trimmed, stripped) values replace the raw input; parsed
 * query values are exposed as req.validatedQuery because Express 5's
 * req.query is read-only.
 */
function validate({ body, params, query } = {}) {
  return function validateRequest(req, _res, next) {
    const issues = [];
    const run = (schema, value, location) => {
      if (!schema) return undefined;
      const result = schema.safeParse(value ?? {});
      if (!result.success) {
        issues.push(...formatIssues(result.error.issues).map((i) => ({ ...i, location })));
        return undefined;
      }
      return result.data;
    };
    const parsedBody = run(body, req.body, 'body');
    const parsedParams = run(params, req.params, 'params');
    const parsedQuery = run(query, req.query, 'query');
    if (issues.length) {
      return next(new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', issues));
    }
    if (body) req.body = parsedBody;
    if (params) req.params = parsedParams;
    if (query) req.validatedQuery = parsedQuery;
    return next();
  };
}

module.exports = { validate, formatIssues };
