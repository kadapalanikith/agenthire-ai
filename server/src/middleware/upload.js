'use strict';

const path = require('node:path');
const multer = require('multer');
const { getSpec } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { sanitizeValue } = require('./sanitize');

/**
 * Single PDF upload in memory (bounded by the spec size limit) so the bytes
 * can be validated before anything touches the disk.
 */
function resumeUpload(fieldName = 'resume') {
  const policy = getSpec('system/upload-policy').resume;
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: policy.max_size_bytes, files: 1, fields: 10, fieldSize: 2048, parts: 12 },
    fileFilter(_req, file, cb) {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!policy.allowed_mime_types.includes(file.mimetype) || !policy.allowed_extensions.includes(ext)) {
        return cb(new AppError(400, ERROR_CODES.INVALID_FILE_TYPE, 'Resume must be a PDF file'));
      }
      return cb(null, true);
    },
  }).single(fieldName);

  return function resumeUploadMiddleware(req, res, next) {
    if (!req.is('multipart/form-data')) {
      return next(new AppError(415, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, 'Submit the application as multipart/form-data'));
    }
    return upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          const mb = Math.round((policy.max_size_bytes / (1024 * 1024)) * 10) / 10;
          return next(new AppError(413, ERROR_CODES.FILE_TOO_LARGE, `Resume must be ${mb} MB or smaller`));
        }
        return next(new AppError(400, ERROR_CODES.VALIDATION_ERROR, `Invalid upload: ${err.message}`));
      }
      if (err) return next(err);
      // Multipart fields arrive after the global sanitiser ran.
      req.body = sanitizeValue(req.body ? { ...req.body } : {});
      if (!req.file) {
        return next(
          new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Request validation failed', [
            { path: fieldName, message: 'Attach your resume as a PDF', location: 'body' },
          ])
        );
      }
      return next();
    });
  };
}

module.exports = { resumeUpload };
