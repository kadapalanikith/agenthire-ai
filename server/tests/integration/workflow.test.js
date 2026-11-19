'use strict';

const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const { createRecruiter } = require('../helpers/auth');
const { createFakeEmbedder } = require('../helpers/fakes');
const { buildPdfFromLines } = require('../../scripts/lib/simplePdf');
const { buildHiringGraph } = require('../../src/workflows/hiringGraph');
const { createMongoCheckpointer } = require('../../src/workflows/checkpointer');
const { WorkflowRunner, setWorkflowRunner } = require('../../src/workflows/runner');
const { createMemoryStore } = require('../../src/rag/vectorStore.memory');
const { AgentError } = require('../../src/workflows/errors');
const { LOG_FILE } = require('../../src/utils/workflowFailureLogger');
const Workflow = require('../../src/models/Workflow');
const WorkflowLog = require('../../src/models/WorkflowLog');
const Candidate = require('../../src/models/Candidate');

const relaxed = { window_ms: 60000, max: 100000 };
const app = createApp({ rateLimits: { auth: relaxed, general: relaxed, application_upload: relaxed, application_status: relaxed } });
const DEMO_PDF = fs.readFileSync(path.resolve(__dirname, '../../../demo-data/resumes/john-react-resume.pdf'));
const FAST_RETRY = { retry_delay_ms: 5 };
const UPLOAD_DIR = process.env.UPLOAD_DIR;

const jobBody = {
  title: 'Frontend Developer',
  description: 'Build accessible interfaces for our recruiter console using React.',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js', 'Tailwind CSS'],
  min_experience: 2,
  hiring_spec_id: 'frontend-developer',
};

let checkpointer;

async function makeRunner({ embedder = createFakeEmbedder(), store = createMemoryStore(), handlersOverride } = {}) {
  const graph = buildHiringGraph({ deps: { llm: null, embedder, store }, checkpointer, retryOverrides: FAST_RETRY, handlersOverride });
  const runner = new WorkflowRunner({ graph, concurrency: 2 });
  setWorkflowRunner(runner);
  return runner;
}

async function setupJob() {
  const recruiter = await createRecruiter(app);
  const job = (await request(app).post('/jobs').set(recruiter.auth).send(jobBody)).body.data.job;
  return { recruiter, job };
}

function apply(jobId, { pdf = DEMO_PDF, email = 'john@example.com', name = 'John Carter' } = {}) {
  return request(app)
    .post('/candidates/upload')
    .field('job_id', jobId)
    .field('name', name)
    .field('email', email)
    .field('phone', '+1 555 010 0199')
    .attach('resume', pdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
}

async function nodeStates(workflowId) {
  const wf = await Workflow.findById(workflowId);
  return Object.fromEntries([...wf.node_states.entries()].map(([k, v]) => [k, v.status]));
}

beforeAll(async () => {
  await startDatabase();
  checkpointer = await createMongoCheckpointer();
});
afterEach(async () => {
  setWorkflowRunner(null);
  await clearDatabase();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});
afterAll(stopDatabase);

describe('automatic workflow execution', () => {
  test('an upload runs resume_parser → embedding → matching → shortlisting and pauses at human_approval', async () => {
    const runner = await makeRunner();
    const { recruiter, job } = await setupJob();
    const res = await apply(job.id);
    expect(res.status).toBe(201);
    await runner.idle();

    const { workflow, candidate_id: candidateId } = res.body.data;
    const wf = await Workflow.findById(workflow.id);
    expect(wf.status).toBe('waiting_approval');
    expect(wf.current_state).toBe('human_approval');
    expect(await nodeStates(workflow.id)).toEqual({
      resume_parser: 'success',
      embedding_agent: 'success',
      matching_agent: 'success',
      shortlisting_agent: 'success',
      human_approval: 'waiting_approval',
      interview_agent: 'pending',
      email_agent: 'pending',
    });
    expect(wf.node_states.get('resume_parser').duration_ms).toBeGreaterThanOrEqual(0);

    const candidate = await Candidate.findById(candidateId);
    expect(candidate.status).toBe('awaiting_review');
    expect(candidate.match_score).toBe(100);
    expect(candidate.ai_recommendation).toBe('shortlisted');
    expect(candidate.parsed_resume_json.skills).toEqual(expect.arrayContaining(['React', 'Next.js']));

    // Logs in execution order.
    const logs = await WorkflowLog.find({ workflow_id: workflow.id }).sort({ created_at: 1, _id: 1 });
    expect(logs.map((l) => `${l.agent_name}:${l.status}`)).toEqual([
      'resume_parser:success',
      'embedding_agent:success',
      'matching_agent:success',
      'shortlisting_agent:success',
      'human_approval:waiting_approval',
    ]);

    // LangGraph checkpoint persisted in MongoDB for this thread.
    const checkpoints = await mongoose.connection.db.collection('checkpoints').countDocuments({ thread_id: wf.thread_id });
    expect(checkpoints).toBeGreaterThan(0);

    // API projections.
    const detail = await request(app).get(`/workflow/${workflow.id}`).set(recruiter.auth);
    expect(detail.status).toBe(200);
    expect(detail.body.data.execution_order[4]).toBe('human_approval');
    expect(detail.body.data.nodes.map((n) => n.status)).toEqual(['success', 'success', 'success', 'success', 'waiting_approval', 'pending', 'pending']);
    expect(detail.body.data.state_output.shortlisting_agent).toMatchObject({ decision: 'shortlisted', recommendation_only: true });
    expect(detail.body.data.logs).toHaveLength(5);

    const cand = await request(app).get(`/candidates/${candidateId}`).set(recruiter.auth);
    expect(cand.body.data.candidate.screening.matching).toMatchObject({ match_score: 100, missing_skills: [], explanation_source: 'deterministic' });
    expect(cand.body.data.candidate.screening.shortlisting).toMatchObject({ decision: 'shortlisted', applied_band: { min_score: 80 } });

    // Candidates only ever see the stage.
    const status = await request(app).get(`/candidates/status/${res.body.data.status_token}`);
    expect(status.body.data.stage).toBe('in_review');
    expect(JSON.stringify(status.body)).not.toMatch(/shortlisted|match_score|100/);
  });

  test('a low-scoring candidate is recommended "rejected" but still waits for a human decision', async () => {
    const runner = await makeRunner();
    const { job } = await setupJob();
    const pdf = buildPdfFromLines(['# Alex Kim', 'Restaurant manager overseeing kitchen staff, ordering and inventory.', '1 year of experience in hospitality operations.']);
    const res = await apply(job.id, { pdf, email: 'alex@example.com', name: 'Alex Kim' });
    await runner.idle();
    const candidate = await Candidate.findById(res.body.data.candidate_id);
    expect(candidate.ai_recommendation).toBe('rejected');
    expect(candidate.status).toBe('awaiting_review'); // never auto-rejected
    expect((await Workflow.findById(res.body.data.workflow.id)).status).toBe('waiting_approval');
  });
});

describe('retries and failures (specs/system/retry-policy.json)', () => {
  test('a transient vector DB failure is retried and the workflow continues', async () => {
    const real = createFakeEmbedder();
    let failures = 2;
    const flaky = {
      model: real.model,
      embedQuery: (t) => real.embedQuery(t),
      async embedDocuments(texts) {
        if (failures > 0) {
          failures -= 1;
          throw new AgentError('VECTOR_DB_TIMEOUT', 'simulated timeout');
        }
        return real.embedDocuments(texts);
      },
    };
    const runner = await makeRunner({ embedder: flaky });
    const { job } = await setupJob();
    const res = await apply(job.id);
    await runner.idle();

    const wf = await Workflow.findById(res.body.data.workflow.id);
    expect(wf.status).toBe('waiting_approval');
    expect(wf.node_states.get('embedding_agent')).toMatchObject({ status: 'success', attempts: 3 });
    const logs = await WorkflowLog.find({ workflow_id: wf._id, agent_name: 'embedding_agent' }).sort({ created_at: 1, _id: 1 });
    expect(logs.map((l) => l.status)).toEqual(['failed', 'failed', 'success']);
    expect(logs[0].error).toMatchObject({ code: 'VECTOR_DB_TIMEOUT', retryable: true });

    const failureLines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((e) => e.workflow_id === String(wf._id));
    expect(failureLines).toHaveLength(2);
    expect(failureLines[0]).toMatchObject({ agent_name: 'embedding_agent', final: false, workflow_state: { current_state: 'embedding_agent' } });
    expect(failureLines[0].error.stack).toContain('simulated timeout');
    expect(failureLines[0].timestamp).toBeDefined();
  });

  test('retries stop after max_retries and the workflow fails with a recorded error', async () => {
    const always = { model: 'x', embedQuery: async () => [], embedDocuments: async () => { throw new AgentError('VECTOR_DB_TIMEOUT', 'down'); } };
    const runner = await makeRunner({ embedder: always });
    const { job } = await setupJob();
    const res = await apply(job.id);
    await runner.idle();
    const wf = await Workflow.findById(res.body.data.workflow.id);
    expect(wf.status).toBe('failed');
    expect(wf.node_states.get('embedding_agent')).toMatchObject({ status: 'failed', attempts: 4 }); // max_retries 3 + 1
    expect(wf.last_error).toMatchObject({ agent_name: 'embedding_agent', code: 'VECTOR_DB_TIMEOUT', retryable: true });
    expect((await Candidate.findById(res.body.data.candidate_id)).status).toBe('failed');
  });

  test('a non-retryable error fails immediately (no retries)', async () => {
    const runner = await makeRunner();
    const { job } = await setupJob();
    // Passes the upload's structural check, but has no readable text.
    const res = await apply(job.id, { pdf: buildPdfFromLines([]) });
    expect(res.status).toBe(201);
    await runner.idle();
    const wf = await Workflow.findById(res.body.data.workflow.id);
    expect(wf.status).toBe('failed');
    expect(wf.node_states.get('resume_parser')).toMatchObject({ status: 'failed', attempts: 1 });
    expect(wf.node_states.get('embedding_agent').status).toBe('pending');
    expect(wf.last_error).toMatchObject({ code: 'NO_EXTRACTABLE_TEXT', retryable: false });
  });
});

describe('persistence and resumability', () => {
  test('after a crash the workflow resumes from its checkpoint without re-running completed nodes', async () => {
    // First run: matching "crashes" (non-retryable) after parser + embedding completed.
    const crashing = await makeRunner({
      handlersOverride: {
        matching_agent: async () => {
          throw new AgentError('SIMULATED_CRASH', 'process died');
        },
      },
    });
    const { job } = await setupJob();
    const res = await apply(job.id);
    await crashing.idle();
    const id = res.body.data.workflow.id;
    expect((await Workflow.findById(id)).status).toBe('failed');

    // Simulate the state a hard process kill leaves behind, then boot recovery.
    await Workflow.updateOne({ _id: id }, { $set: { status: 'running' } });
    const fresh = await makeRunner();
    expect(await fresh.recover()).toEqual({ recovered: 1, started: 0 });
    await fresh.idle();

    const wf = await Workflow.findById(id);
    expect(wf.status).toBe('waiting_approval');
    expect(wf.node_states.get('resume_parser').attempts).toBe(1);
    expect(wf.node_states.get('embedding_agent').attempts).toBe(1);
    expect(wf.node_states.get('matching_agent').attempts).toBe(2);
    expect(wf.node_states.get('shortlisting_agent').attempts).toBe(1);
  });

  test('pending workflows (engine was not running at upload) are started by boot recovery', async () => {
    const { job } = await setupJob();
    const res = await apply(job.id); // no runner registered
    expect((await Workflow.findById(res.body.data.workflow.id)).status).toBe('pending');
    const runner = await makeRunner();
    expect(await runner.recover()).toEqual({ recovered: 0, started: 1 });
    await runner.idle();
    expect((await Workflow.findById(res.body.data.workflow.id)).status).toBe('waiting_approval');
  });

  test('the same workflow is never executed twice concurrently', async () => {
    const runner = await makeRunner();
    const { job } = await setupJob();
    setWorkflowRunner(null);
    const res = await apply(job.id);
    const id = res.body.data.workflow.id;
    expect(runner.enqueue(id)).toBe(true);
    expect(runner.enqueue(id)).toBe(false);
    await runner.idle();
    expect(runner.enqueue(id)).toBe(true); // already waiting_approval: the claim fails, nothing runs
    await runner.idle();
    expect((await WorkflowLog.countDocuments({ workflow_id: id, agent_name: 'resume_parser' }))).toBe(1);
  });
});

describe('workflow API', () => {
  test('GET /workflow lists the recruiter’s workflows with node states', async () => {
    const runner = await makeRunner();
    const { recruiter, job } = await setupJob();
    const other = await createRecruiter(app);
    await apply(job.id);
    await runner.idle();
    const res = await request(app).get('/workflow').set(recruiter.auth);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data.workflows[0]).toMatchObject({
      status: 'waiting_approval',
      candidate: { name: 'John Carter', ai_recommendation: 'shortlisted' },
      job: { title: 'Frontend Developer' },
    });
    expect(res.body.data.workflows[0].nodes).toHaveLength(7);
    expect((await request(app).get('/workflow?status=failed').set(recruiter.auth)).body.meta.total).toBe(0);
    expect((await request(app).get('/workflow').set(other.auth)).body.meta.total).toBe(0);
  });

  test('GET /workflow/:id is owner-scoped', async () => {
    const runner = await makeRunner();
    const { job } = await setupJob();
    const other = await createRecruiter(app);
    const res = await apply(job.id);
    await runner.idle();
    expect((await request(app).get(`/workflow/${res.body.data.workflow.id}`).set(other.auth)).status).toBe(404);
    expect((await request(app).get(`/workflow/${res.body.data.workflow.id}`)).status).toBe(401);
  });

  test('POST /workflow/start starts a pending workflow and refuses others', async () => {
    const { recruiter, job } = await setupJob();
    const res = await apply(job.id); // no runner: stays pending
    const runner = await makeRunner();
    const started = await request(app).post('/workflow/start').set(recruiter.auth).send({ candidate_id: res.body.data.candidate_id });
    expect(started.status).toBe(202);
    await runner.idle();
    expect((await Workflow.findById(res.body.data.workflow.id)).status).toBe('waiting_approval');
    const again = await request(app).post('/workflow/start').set(recruiter.auth).send({ candidate_id: res.body.data.candidate_id });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('WORKFLOW_STATE_CONFLICT');
  });
});
