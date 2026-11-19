'use strict';

const fs = require('node:fs');
const request = require('supertest');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const { createRecruiter } = require('../helpers/auth');
const { createFakeEmbedder } = require('../helpers/fakes');
const { buildPdfFromLines } = require('../../scripts/lib/simplePdf');
const { createHarness, setWorkflowRunner } = require('../helpers/workflowHarness');
const { AgentError } = require('../../src/workflows/errors');
const Workflow = require('../../src/models/Workflow');
const WorkflowLog = require('../../src/models/WorkflowLog');
const Candidate = require('../../src/models/Candidate');

const h = createHarness();
const { app } = h;

const attempts = async (id) => Object.fromEntries([...(await Workflow.findById(id)).node_states.entries()].map(([k, v]) => [k, v.attempts]));
const statuses = async (id) => Object.fromEntries([...(await Workflow.findById(id)).node_states.entries()].map(([k, v]) => [k, v.status]));

beforeAll(async () => {
  await startDatabase();
  await h.init();
});
afterEach(async () => {
  setWorkflowRunner(null);
  await clearDatabase();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});
afterAll(stopDatabase);

describe('GET /workflow/:id approval request', () => {
  test('includes what the recruiter reviews while waiting', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const app1 = await h.applyAndWait(runner, job.id);
    const res = await request(app).get(`/workflow/${app1.workflow.id}`).set(recruiter.auth);
    expect(res.body.data.approval_request).toMatchObject({
      type: 'human_approval',
      ai_recommendation: 'shortlisted',
      match_score: 100,
      missing_skills: [],
      reason_required: { approve: false, reject: true }, // rejecting a "shortlisted" recommendation is an override
      reason_min_length: 10,
    });
    expect(res.body.data.workflow.decision_pending).toBe(false);
  });

  test('/meta/workflow-spec serves node labels and approval rules from the specs', async () => {
    const res = await request(app).get('/meta/workflow-spec');
    expect(res.body.data.node_labels.human_approval).toBe('Human Approval');
    expect(res.body.data.approval_rules).toEqual({ override_requires_reason: true, override_reason_min_length: 10 });
  });
});

describe('POST /workflow/approve', () => {
  test('approve resumes from the checkpoint without re-running nodes 1-4 and records the decision', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const id = a.workflow.id;

    const res = await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: id, decision: 'approve' });
    expect(res.status).toBe(202);
    expect(res.body.data.approval).toMatchObject({ decision: 'approve', overridden: false, ai_recommendation: 'shortlisted' });
    await runner.idle();

    // Resumed: the first four agents ran exactly once in total.
    expect(await attempts(id)).toMatchObject({ resume_parser: 1, embedding_agent: 1, matching_agent: 1, shortlisting_agent: 1, human_approval: 1 });
    const wf = await Workflow.findById(id);
    expect(wf.approval).toMatchObject({ decision: 'approve', decided_by: expect.anything(), overridden: false });
    expect(wf.pending_decision).toBeNull();
    expect((await statuses(id)).human_approval).toBe('success');
    expect((await Candidate.findById(a.candidate_id)).status).toBe('approved');

    // The interview agent is Phase 7: it fails explicitly, and the decision is not overwritten.
    expect(wf.status).toBe('failed');
    expect(wf.last_error).toMatchObject({ agent_name: 'interview_agent', code: 'NOT_IMPLEMENTED', retryable: false });
    const logs = await WorkflowLog.find({ workflow_id: id }).sort({ created_at: 1, _id: 1 });
    expect(logs.map((l) => `${l.agent_name}:${l.status}`)).toEqual([
      'resume_parser:success',
      'embedding_agent:success',
      'matching_agent:success',
      'shortlisting_agent:success',
      'human_approval:waiting_approval',
      'human_approval:success',
      'interview_agent:failed',
    ]);
  });

  test('reject skips the interview agent and goes to the email agent', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const pdf = buildPdfFromLines(['# Alex Kim', 'Restaurant manager overseeing kitchen staff, ordering and inventory.', '1 year of experience in hospitality operations.']);
    const a = await h.applyAndWait(runner, job.id, { pdf, email: 'alex@example.com', name: 'Alex Kim' });

    const res = await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: a.workflow.id, decision: 'reject' });
    expect(res.status).toBe(202);
    await runner.idle();
    const s = await statuses(a.workflow.id);
    expect(s).toMatchObject({ human_approval: 'success', interview_agent: 'skipped', email_agent: 'failed' });
    expect(await WorkflowLog.countDocuments({ workflow_id: a.workflow.id, agent_name: 'interview_agent', status: 'skipped' })).toBe(1);
    expect((await Candidate.findById(a.candidate_id)).status).toBe('rejected');
    expect((await Workflow.findById(a.workflow.id)).last_error).toMatchObject({ agent_name: 'email_agent', code: 'NOT_IMPLEMENTED' });
  });

  test('overriding the AI recommendation requires a recorded reason', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id); // shortlisted

    const noReason = await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: a.workflow.id, decision: 'reject' });
    expect(noReason.status).toBe(400);
    expect(noReason.body.error.details[0].path).toBe('reason');
    const short = await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: a.workflow.id, decision: 'reject', reason: 'no' });
    expect(short.status).toBe(400);
    expect((await Workflow.findById(a.workflow.id)).status).toBe('waiting_approval');

    const ok = await request(app)
      .post('/workflow/approve')
      .set(recruiter.auth)
      .send({ workflow_id: a.workflow.id, decision: 'reject', reason: 'Role requires on-site availability the candidate declined' });
    expect(ok.status).toBe(202);
    await runner.idle();
    expect((await Workflow.findById(a.workflow.id)).approval).toMatchObject({ overridden: true, reason: 'Role requires on-site availability the candidate declined' });
  });

  test('a workflow can be decided only once, even with concurrent requests', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const send = () => request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: a.workflow.id, decision: 'approve' });
    const results = await Promise.all([send(), send(), send()]);
    expect(results.map((r) => r.status).sort()).toEqual([202, 409, 409]);
    await runner.idle();
    expect(await WorkflowLog.countDocuments({ workflow_id: a.workflow.id, agent_name: 'human_approval', status: 'success' })).toBe(1);
    expect((await send()).status).toBe(409);
  });

  test('is owner-scoped and validates input', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const other = await createRecruiter(app);
    const a = await h.applyAndWait(runner, job.id);
    expect((await request(app).post('/workflow/approve').set(other.auth).send({ workflow_id: a.workflow.id, decision: 'approve' })).status).toBe(404);
    expect((await request(app).post('/workflow/approve').send({ workflow_id: a.workflow.id, decision: 'approve' })).status).toBe(401);
    expect((await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: a.workflow.id, decision: 'maybe' })).status).toBe(400);
  });

  test('a decision accepted before a crash is applied by boot recovery', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    // Simulate: approve accepted (status running + stored decision) but the process died before resuming.
    await Workflow.updateOne(
      { _id: a.workflow.id },
      { $set: { status: 'running', pending_decision: { decision: 'approve', reason: null, decided_by: recruiter.user.id, decided_at: new Date().toISOString() } } }
    );
    const fresh = h.makeRunner();
    await fresh.recover();
    await fresh.idle();
    const wf = await Workflow.findById(a.workflow.id);
    expect(wf.approval).toMatchObject({ decision: 'approve' });
    expect(wf.pending_decision).toBeNull();
    expect(await attempts(a.workflow.id)).toMatchObject({ resume_parser: 1, matching_agent: 1 });
  });

  test('recovery does not resume a paused workflow that has no decision', async () => {
    const runner = h.makeRunner();
    const { job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    await Workflow.updateOne({ _id: a.workflow.id }, { $set: { status: 'running' } }); // stale status, no decision
    const fresh = h.makeRunner();
    await fresh.recover();
    await fresh.idle();
    const wf = await Workflow.findById(a.workflow.id);
    expect(wf.status).toBe('waiting_approval');
    expect(wf.approval).toBeNull();
  });
});

describe('POST /workflow/retry', () => {
  test('retries a failed workflow from its checkpoint: completed nodes are not re-run', async () => {
    let down = true;
    const real = createFakeEmbedder();
    const embedder = {
      model: real.model,
      embedQuery: (t) => real.embedQuery(t),
      embedDocuments: async (t) => {
        if (down) throw new AgentError('VECTOR_DB_TIMEOUT', 'qdrant down');
        return real.embedDocuments(t);
      },
    };
    const runner = h.makeRunner({ embedder });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    expect((await Workflow.findById(a.workflow.id)).status).toBe('failed');
    expect(await attempts(a.workflow.id)).toMatchObject({ resume_parser: 1, embedding_agent: 4 });

    down = false; // the vector database is back
    const res = await request(app).post('/workflow/retry').set(recruiter.auth).send({ workflow_id: a.workflow.id });
    expect(res.status).toBe(202);
    expect(res.body.data.workflow.retry_count).toBe(1);
    await runner.idle();

    const wf = await Workflow.findById(a.workflow.id);
    expect(wf.status).toBe('waiting_approval');
    expect(wf.last_error).toBeNull();
    expect(await attempts(a.workflow.id)).toMatchObject({ resume_parser: 1, embedding_agent: 5, matching_agent: 1 });
    expect((await Candidate.findById(a.candidate_id)).status).toBe('awaiting_review');
  });

  test('retry gets a fresh retry budget (attempts are counted per run)', async () => {
    let failuresLeft = 5; // 4 in the first run (exhausted), 1 in the retry run
    const real = createFakeEmbedder();
    const embedder = {
      model: real.model,
      embedQuery: (t) => real.embedQuery(t),
      embedDocuments: async (t) => {
        if (failuresLeft > 0) {
          failuresLeft -= 1;
          throw new AgentError('VECTOR_DB_TIMEOUT', 'flaky');
        }
        return real.embedDocuments(t);
      },
    };
    const runner = h.makeRunner({ embedder });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    await request(app).post('/workflow/retry').set(recruiter.auth).send({ workflow_id: a.workflow.id });
    await runner.idle();
    expect((await Workflow.findById(a.workflow.id)).status).toBe('waiting_approval');
    const failed = await WorkflowLog.find({ workflow_id: a.workflow.id, agent_name: 'embedding_agent', status: 'failed' });
    expect(failed).toHaveLength(5);
  });

  test('only failed workflows can be retried', async () => {
    const runner = h.makeRunner();
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const res = await request(app).post('/workflow/retry').set(recruiter.auth).send({ workflow_id: a.workflow.id });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('WORKFLOW_STATE_CONFLICT');
  });
});
