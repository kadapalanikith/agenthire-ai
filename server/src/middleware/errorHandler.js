'use strict';

const mongoose = require('mongoose');
const { AppError } = require('../utils/AppError');
const { errorBody } = require('../utils/apiResponse');
const { ERROR_CODES } = require('../constants/errorCodes');
const { logger } = require('../utils/logger');

function notFound(req, _res, next) {
  next(new AppError(404, ERROR_CODES.NOT_FOUND, `Route ${req.method} ${req.path} not found`));
}

/** Translate known library errors into AppErrors. */
function normalize(err) {
  if (err instanceof AppError) return err;
  if (err && err.type === 'entity.parse.failed') return new AppError(400, ERROR_CODES.INVALID_JSON, 'Request body is not valid JSON');
  if (err && err.type === 'entity.too.large') return new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, 'Request body is too large');
  if (err && err.type === 'encoding.unsupported') return new AppError(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, 'Unsupported request encoding');
  if (err instanceof mongoose.Error.CastError) return new AppError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid value for ${err.path}`);
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Validation failed', details);
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const known = normalize(err);
  if (known) {
    if (known.status >= 500) logger.error({ err, reqId: req.id }, known.message);
    return res.status(known.status).json(errorBody(known.code, known.message, known.details));
  }
  // Unexpected: log the full error server-side, return a generic message.
  logger.error({ err, reqId: req.id, method: req.method, path: req.path }, 'Unhandled error');
  return res
    .status(500)
    .json(errorBody(ERROR_CODES.INTERNAL_ERROR, 'An unexpected error occurred', { request_id: req.id }));
}

module.exports = { errorHandler, notFound };
