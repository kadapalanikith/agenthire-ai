'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const { getEnv } = require('../config/env');
const { getSpec } = require('../utils/specLoader');
const { AppError } = require('../utils/AppError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { sendTemplatedEmail } = require('../emails/emailService');
const { hashPassword } = require('./auth.service');
const { logger } = require('../utils/logger');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function buildResetUrl(rawToken) {
  const url = new URL('/reset-password', getEnv().PUBLIC_WEB_URL);
  url.searchParams.set('token', rawToken);
  return url.toString();
}

/**
 * Create a single-use reset token and email it. Callers always receive the
 * same response, whether or not the email exists (no account enumeration).
 * Resolves with the delivery result for the account, or null.
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ email });
  if (!user) return null;

  const ttlMinutes = getSpec('system/auth-policy').password_reset.token_ttl_minutes;
  const rawToken = crypto.randomBytes(32).toString('hex');

  // Only the newest token is valid.
  await PasswordResetToken.deleteMany({ user_id: user._id, used_at: null });
  await PasswordResetToken.create({
    user_id: user._id,
    token_hash: hashToken(rawToken),
    expires_at: new Date(Date.now() + ttlMinutes * 60 * 1000),
  });

  return sendTemplatedEmail({
    to: user.email,
    templateId: 'password-reset',
    variables: { user_name: user.name, reset_url: buildResetUrl(rawToken), ttl_minutes: ttlMinutes },
  });
}

/** Fire-and-forget wrapper so response timing does not depend on account existence. */
function requestPasswordResetInBackground(email) {
  requestPasswordReset(email).catch((err) => {
    logger.error({ err: { message: err.message, code: err.code } }, 'Password reset email could not be processed');
  });
}

async function resetPassword({ token, password }) {
  const now = new Date();
  // Atomically consume the token so it cannot be used twice.
  const record = await PasswordResetToken.findOneAndUpdate(
    { token_hash: hashToken(token), used_at: null, expires_at: mongoose.trusted({ $gt: now }) },
    { $set: { used_at: now } },
    { returnDocument: 'after' }
  );
  if (!record) throw new AppError(400, ERROR_CODES.INVALID_RESET_TOKEN, 'This reset link is invalid or has expired');

  const updated = await User.findByIdAndUpdate(record.user_id, {
    $set: { password: await hashPassword(password), password_changed_at: now },
  });
  if (!updated) throw new AppError(400, ERROR_CODES.INVALID_RESET_TOKEN, 'This reset link is invalid or has expired');
  await PasswordResetToken.deleteMany({ user_id: record.user_id, used_at: null });
}

module.exports = { requestPasswordReset, requestPasswordResetInBackground, resetPassword, hashToken, buildResetUrl };
