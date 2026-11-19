'use strict';

const mongoose = require('mongoose');
const { JOB_STATUSES, JOB_LIMITS } = require('../constants/jobs');

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: JOB_LIMITS.TITLE_MAX },
    description: { type: String, required: true, trim: true, maxlength: JOB_LIMITS.DESCRIPTION_MAX },
    required_skills: { type: [String], required: true },
    preferred_skills: { type: [String], default: [] },
    min_experience: { type: Number, required: true, min: 0, max: JOB_LIMITS.MIN_EXPERIENCE_MAX },
    // References into /specs — validated against the spec registry by the service.
    workflow_spec_id: { type: String, required: true },
    hiring_spec_id: { type: String, required: true },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: JOB_STATUSES, default: 'open', required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        ret.created_by = ret.created_by ? String(ret.created_by) : ret.created_by;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

jobSchema.index({ created_by: 1, created_at: -1 });
jobSchema.index({ status: 1, created_at: -1 });

module.exports = mongoose.models.Job || mongoose.model('Job', jobSchema, 'jobs');
