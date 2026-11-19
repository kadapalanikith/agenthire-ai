'use strict';

const mongoose = require('mongoose');
const Workflow = require('../models/Workflow');
const Candidate = require('../models/Candidate');
const { classifyError } = require('./errors');
const { logger } = require('../utils/logger');

/**
 * In-process workflow runner (single API instance; upgrade path: BullMQ +
 * Redis). Runs graph executions with bounded concurrency, projects the
 * LangGraph outcome onto the workflow/candidate records, and recovers
 * interrupted runs on boot.
 */
class WorkflowRunner {
  constructor({ graph, concurrency = 2 }) {
    this.graph = graph;
    this.concurrency = concurrency;
    this.queue = [];
    this.active = new Set();
    this.queued = new Set();
    this.idleWaiters = [];
  }

  /** Queue a run. mode: 'start' (pending → running) | 'recover' (resume an interrupted run). */
  enqueue(workflowId, { mode = 'start' } = {}) {
    const id = String(workflowId);
    if (this.queued.has(id) || this.active.has(id)) return false;
    this.queued.add(id);
    this.queue.push({ id, mode });
    setImmediate(() => this.pump());
    return true;
  }

  pump() {
    while (this.active.size < this.concurrency && this.queue.length) {
      const job = this.queue.shift();
      this.queued.delete(job.id);
      this.active.add(job.id);
      this.execute(job)
        .catch((err) => logger.error({ err: err.message, workflow_id: job.id }, 'Workflow runner error'))
        .finally(() => {
          this.active.delete(job.id);
          this.pump();
          if (!this.active.size && !this.queue.length) this.idleWaiters.splice(0).forEach((r) => r());
        });
    }
  }

  /** Resolves when nothing is running or queued (used by tests and shutdown). */
  idle() {
    if (!this.active.size && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async execute({ id, mode }) {
    const claimFrom = mode === 'recover' ? ['running'] : ['pending'];
    // Atomic claim prevents two executions of the same workflow.
    const wf = await Workflow.findOneAndUpdate(
      { _id: id, status: mongoose.trusted({ $in: claimFrom }) },
      { $set: { status: 'running', last_error: null } },
      { returnDocument: 'after' }
    );
    if (!wf) return;
    await Candidate.updateOne({ _id: wf.candidate_id, status: mongoose.trusted({ $in: ['applied', 'failed'] }) }, { $set: { status: 'processing' } });

    const config = { configurable: { thread_id: wf.thread_id } };
    const existing = await this.graph.getState(config);
    const hasCheckpoint = Boolean(existing && existing.values && existing.values.workflow_id);
    const input = hasCheckpoint ? null : { workflow_id: String(wf._id), candidate_id: String(wf.candidate_id), job_id: String(wf.job_id) };

    try {
      await this.graph.invoke(input, config);
      await this.projectOutcome(wf, config);
    } catch (err) {
      await this.markFailed(wf, err);
    }
  }

  /** After invoke: paused at human approval, or finished. */
  async projectOutcome(wf, config) {
    const snapshot = await this.graph.getState(config);
    const interrupted = snapshot.tasks?.some((t) => t.interrupts && t.interrupts.length);
    if (snapshot.next?.length && interrupted) {
      const node = snapshot.next[0];
      await Workflow.updateOne(
        { _id: wf._id },
        { $set: { status: 'waiting_approval', current_state: node, [`node_states.${node}.status`]: 'waiting_approval' } }
      );
      await Candidate.updateOne({ _id: wf.candidate_id }, { $set: { status: 'awaiting_review' } });
      return;
    }
    if (!snapshot.next?.length) {
      await Workflow.updateOne({ _id: wf._id }, { $set: { status: 'completed', current_state: null } });
    }
  }

  async markFailed(wf, err) {
    const fresh = await Workflow.findById(wf._id).select('current_state');
    const { code, retryable } = classifyError(err);
    await Workflow.updateOne(
      { _id: wf._id },
      {
        $set: {
          status: 'failed',
          last_error: { agent_name: fresh?.current_state ?? null, code, message: err.message, retryable, at: new Date() },
          ...(fresh?.current_state ? { [`node_states.${fresh.current_state}.status`]: 'failed' } : {}),
        },
      }
    );
    await Candidate.updateOne({ _id: wf.candidate_id }, { $set: { status: 'failed' } });
  }

  /** Boot recovery: resume runs interrupted by a restart; start queued ones. */
  async recover() {
    const [running, pending] = await Promise.all([
      Workflow.find({ status: 'running' }).select('_id'),
      Workflow.find({ status: 'pending' }).select('_id'),
    ]);
    running.forEach((w) => this.enqueue(w._id, { mode: 'recover' }));
    pending.forEach((w) => this.enqueue(w._id, { mode: 'start' }));
    if (running.length || pending.length) logger.info({ running: running.length, pending: pending.length }, 'Workflow recovery queued');
    return { recovered: running.length, started: pending.length };
  }
}

let runner = null;

function getWorkflowRunner() {
  return runner;
}

function setWorkflowRunner(r) {
  runner = r;
}

module.exports = { WorkflowRunner, getWorkflowRunner, setWorkflowRunner };
