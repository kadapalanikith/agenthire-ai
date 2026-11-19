'use strict';

const mongoose = require('mongoose');
const { CANDIDATE_STATUSES } = require('../constants/candidates');
const { RECOMMENDATIONS } = require('../constants/workflow');

const resumeFileSchema = new mongoose.Schema(
  {
    original_name: { type: String, required: true },
    size_bytes: { type: Number, required: true },
    mime_type: { type: String, required: true },
    sha256: { type: String, required: true },
  },
  { _id: false }
);

const candidateSchema = new mongoose.Schema(
  {
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    workflow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    // Internal storage key under UPLOAD_DIR. Never served directly.
    resume_url: { type: String, required: true },
    resume_file: { type: resumeFileSchema, required: true },
    parsed_resume_json: { type: mongoose.Schema.Types.Mixed, default: null },
    match_score: { type: Number, default: null, min: 0, max: 100 },
    ai_recommendation: { type: String, enum: [...RECOMMENDATIONS, null], default: null },
    status: { type: String, enum: CANDIDATE_STATUSES, default: 'applied', required: true },
    // SHA-256 of the candidate's public status token.
    status_token_hash: { type: String, required: true, unique: true, select: false },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        for (const key of ['job_id', 'workflow_id']) if (ret[key]) ret[key] = String(ret[key]);
        delete ret._id;
        delete ret.__v;
        delete ret.status_token_hash;
        delete ret.resume_url;
        return ret;
      },
    },
  }
);

// One application per email per job.
candidateSchema.index({ job_id: 1, email: 1 }, { unique: true });
candidateSchema.index({ job_id: 1, created_at: -1 });

module.exports = mongoose.models.Candidate || mongoose.model('Candidate', candidateSchema, 'candidates');
