'use strict';

const mongoose = require('mongoose');
const { ROLE_VALUES, ROLES } = require('../constants/roles');

const pushTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    created_at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.RECRUITER, required: true },
    // Tokens issued before this instant are rejected (set on password reset).
    password_changed_at: { type: Date, select: false },
    push_tokens: { type: [pushTokenSchema], default: [], select: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.password_changed_at;
        delete ret.push_tokens;
        return ret;
      },
    },
  }
);

module.exports = mongoose.models.User || mongoose.model('User', userSchema, 'users');
