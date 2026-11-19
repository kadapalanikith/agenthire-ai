'use strict';

const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { Command } = require('@langchain/langgraph');
const Workflow = require('../models/Workflow');
const Candidate = require('../models/Candidate');
const { classifyError } = require('./errors');
const { clearRunAttempts } = require('./nodeLifecycle');
const { getSpec } = require('../utils/specLoader');
const { logger } = require('../utils/logger');

const DECIDED = ['approved', 'rejected'];

/**
 * In-process workflow runner (single API instance; upgrade path: BullMQ +
 * Redis). Runs graph executions with bounded concurrency, projects the
 * LangGraph outcome onto workflow/candidate records, and recovers
 * interrupted runs on boot.
 *
 * Modes:
 *   start    → claim a `pending` workflow and run it from the beginning.
 *   continue → the workflow is already `running` (claimed by approve/retry or
 *              left by a crash): resume from its checkpoint. If it is paused at
 *              the approval checkpoint and a decision is stored, resume with it.
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

  idle() {
    if (!this.active.size && !this.queue.length) return Promise.resolve();
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  async execute({ id, mode }) {
    let wf;
    if (mode === 'start') {
      // Atomic claim prevents two executions of the same workflow.
      wf = await Workflow.findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'running', last_error: null } }, { returnDocument: 'after' });
    } else {
      wf = await Workflow.findOne({ _id: id, status: 'running' });
    }
    if (!wf) return;
    await Candidate.updateOne({ _id: wf.candidate_id, status: mongoose.trusted({ $in: ['applied', 'failed'] }) }, { $set: { status: 'processing' } });

    const runId = crypto.randomUUID();
    const config = { configurable: { thread_id: wf.thread_id, run_id: runId } };
    const input = await this.resolveInput(wf, config);
    if (input && input.__still_waiting) {
      await Workflow.updateOne({ _id: wf._id }, { $set: { status: 'waiting_approval' } });
      clearRunAttempts(runId);
      return;
    }
    try {
      await this.graph.invoke(input, config);
      await this.projectOutcome(wf, config);
    } catch (err) {
      await this.markFailed(wf, err);
    } finally {
      clearRunAttempts(runId);
    }
  }

  /** Initial input, a resume Command for a stored decision, or null (continue from checkpoint). */
  async resolveInput(wf, config) {
    const snapshot = await this.graph.getState(config);
    const hasCheckpoint = Boolean(snapshot && snapshot.values && snapshot.values.workflow_id);
    if (!hasCheckpoint) {
      return { workflow_id: String(wf._id), candidate_id: String(wf.candidate_id), job_id: String(wf.job_id) };
    }
    const checkpointNodes = getSpec('workflow/default-hiring-workflow').checkpoint_nodes;
    const pausedAtCheckpoint = snapshot.next?.some((n) => checkpointNodes.includes(n)) && snapshot.tasks?.some((t) => t.interrupts?.length);
    if (pausedAtCheckpoint) {
      if (!wf.pending_decision) {
        // Nothing to resume with: it is still waiting for a recruiter.
        return { __still_waiting: true };
      }
      return new Command({ resume: wf.pending_decision });
    }
    return null;
  }

  async projectOutcome(wf, config) {
    const snapshot = await this.graph.getState(config);
    const interrupted = snapshot.tasks?.some((t) => t.interrupts && t.interrupts.length);
    if (snapshot.next?.length && interrupted) {
      const node = snapshot.next[0];
      await Workflow.updateOne(
        { _id: wf._id },
        { $set: { status: 'waiting_approval', current_state: node, [`node_states.${node}.status`]: 'waiting_approval' } }
      );
      await Candidate.updateOne({ _id: wf.candidate_id, status: mongoose.trusted({ $nin: DECIDED }) }, { $set: { status: 'awaiting_review' } });
      return;
    }
    if (!snapshot.next?.length) {
      await Workflow.updateOne({ _id: wf._id }, { $set: { status: 'completed', current_state: null, pending_decision: null } });
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
    // A recruiter's decision is final: later failures (e.g. email) never overwrite it.
    await Candidate.updateOne({ _id: wf.candidate_id, status: mongoose.trusted({ $nin: DECIDED }) }, { $set: { status: 'failed' } });
  }

  /** Boot recovery: continue runs interrupted by a restart; start queued ones. */
  async recover() {
    const [running, pending] = await Promise.all([
      Workflow.find({ status: 'running' }).select('_id'),
      Workflow.find({ status: 'pending' }).select('_id'),
    ]);
    running.forEach((w) => this.enqueue(w._id, { mode: 'continue' }));
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
