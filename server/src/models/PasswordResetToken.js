'use strict';

const mongoose = require('mongoose');

/** Only the SHA-256 hash of a reset token is stored; the raw token is emailed once. */
const passwordResetTokenSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } }
);

// MongoDB removes expired tokens automatically.
passwordResetTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.PasswordResetToken ||
  mongoose.model('PasswordResetToken', passwordResetTokenSchema, 'password_reset_tokens');
