'use strict';

const mongoose = require('mongoose');
const { WORKFLOW_LOG_STATUSES } = require('../constants/workflow');

/** One entry per node attempt (original spec: workflow_logs collection). */
const workflowLogSchema = new mongoose.Schema(
  {
    workflow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
    agent_name: { type: String, required: true },
    status: { type: String, enum: WORKFLOW_LOG_STATUSES, required: true },
    attempt: { type: Number, default: 1 },
    input: { type: mongoose.Schema.Types.Mixed, default: null },
    output: { type: mongoose.Schema.Types.Mixed, default: null },
    error: {
      type: new mongoose.Schema(
        { code: String, message: String, retryable: Boolean, stack: { type: String, select: false } },
        { _id: false }
      ),
      default: null,
    },
    duration_ms: { type: Number, default: null },
    completed_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: false },
    minimize: false,
    toJSON: {
      transform(_doc, ret) {
        ret.id = String(ret._id);
        ret.workflow_id = String(ret.workflow_id);
        delete ret._id;
        delete ret.__v;
        if (ret.error) delete ret.error.stack;
        return ret;
      },
    },
  }
);

workflowLogSchema.index({ workflow_id: 1, created_at: 1 });
workflowLogSchema.index({ agent_name: 1, status: 1 });

module.exports = mongoose.models.WorkflowLog || mongoose.model('WorkflowLog', workflowLogSchema, 'workflow_logs');
