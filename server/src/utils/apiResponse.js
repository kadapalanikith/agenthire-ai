'use strict';

/** Send the standard success envelope: { success: true, data, meta? }. */
function sendSuccess(res, data, { status = 200, meta } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

/** Build the standard error envelope: { success: false, error: { code, message, details? } }. */
function errorBody(code, message, details) {
  const error = { code, message };
  if (details !== undefined) error.details = details;
  return { success: false, error };
}

module.exports = { sendSuccess, errorBody };
