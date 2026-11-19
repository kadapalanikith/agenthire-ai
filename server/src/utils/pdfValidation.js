'use strict';

const { AppError } = require('./AppError');
const { ERROR_CODES } = require('../constants/errorCodes');

const PDF_SIGNATURE = Buffer.from('%PDF-');
const PDF_EOF = Buffer.from('%%EOF');
const TRAILER_WINDOW = 2048;

/** Non-retryable per specs/system/retry-policy.json (INVALID_PDF). */
function invalidPdf(message) {
  return new AppError(400, ERROR_CODES.INVALID_PDF, message);
}

/**
 * Structural PDF checks on the uploaded bytes (never trust the client's
 * MIME type or file name): the file must start with the %PDF- signature and
 * contain an %%EOF marker near its end. Text extraction happens in the
 * resume parser agent.
 */
function assertPdfBuffer(buffer, { requireSignature = true } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw invalidPdf('The uploaded file is empty');
  if (!requireSignature) return;
  if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) {
    throw invalidPdf('The uploaded file is not a PDF');
  }
  const tail = buffer.subarray(Math.max(0, buffer.length - TRAILER_WINDOW));
  if (tail.indexOf(PDF_EOF) === -1) throw invalidPdf('The PDF appears to be incomplete or corrupted');
}

module.exports = { assertPdfBuffer };
