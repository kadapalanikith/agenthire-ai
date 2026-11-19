'use strict';

const mongoose = require('mongoose');
const { WORKFLOW_STATUSES, NODE_STATUSES, APPROVAL_DECISIONS, RECOMMENDATIONS } = require('../constants/workflow');

const nodeStateSchema = new mongoose.Schema(
  {
    status: { type: String, enum: NODE_STATUSES, default: 'pending' },
    started_at: { type: Date, default: null },
    completed_at: { type: Date, default: null },
    duration_ms: { type: Number, default: null },
    attempts: { type: Number, default: 0 },
  },
  { _id: false }
);

const approvalSchema = new mongoose.Schema(
  {
    decision: { type: String, enum: APPROVAL_DECISIONS, required: true },
    reason: { type: String, default: null },
    ai_recommendation: { type: String, enum: [...RECOMMENDATIONS, null], default: null },
    overridden: { type: Boolean, default: false },
    decided_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decided_at: { type: Date, required: true },
  },
  { _id: false }
);

/**
 * Domain projection of a LangGraph run (UI / analytics). The LangGraph
 * checkpointer (Phase 5) is the source of truth for resuming; thread_id
 * links the two.
 */
const workflowSchema = new mongoose.Schema(
  {
    candidate_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', required: true, unique: true },
    job_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    workflow_spec_id: { type: String, required: true },
    thread_id: { type: String, required: true, unique: true },
    status: { type: String, enum: WORKFLOW_STATUSES, default: 'pending', required: true },
    current_state: { type: String, default: null },
    execution_order: { type: [String], required: true },
    node_states: { type: Map, of: nodeStateSchema, default: {} },
    state_output: { type: mongoose.Schema.Types.Mixed, default: {} },
    retry_count: { type: Number, default: 0 },
    approval: { type: approvalSchema, default: null },
    spec_versions: { type: mongoose.Schema.Types.Mixed, required: true },
    last_error: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    minimize: false,
    toJSON: {
      flattenMaps: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        for (const key of ['candidate_id', 'job_id']) if (ret[key]) ret[key] = String(ret[key]);
        if (ret.approval && ret.approval.decided_by) ret.approval.decided_by = String(ret.approval.decided_by);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

workflowSchema.index({ status: 1, updated_at: -1 });

module.exports = mongoose.models.Workflow || mongoose.model('Workflow', workflowSchema, 'workflows');
