'use strict';

const fs = require('node:fs');
const request = require('supertest');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const { createHarness, setWorkflowRunner } = require('../helpers/workflowHarness');
const { AgentError } = require('../../src/workflows/errors');
const { EmailDeliveryError } = require('../../src/emails/emailService');
const Workflow = require('../../src/models/Workflow');
const WorkflowLog = require('../../src/models/WorkflowLog');
const Candidate = require('../../src/models/Candidate');

const h = createHarness();
const { app } = h;

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

async function approveAndWait(runner, recruiter, workflowId, decision = 'approve', reason) {
  const res = await request(app).post('/workflow/approve').set(recruiter.auth).send({ workflow_id: workflowId, decision, ...(reason ? { reason } : {}) });
  expect(res.status).toBe(202);
  await runner.idle();
  return Workflow.findById(workflowId);
}

describe('full workflow completion (Phase 7)', () => {
  test('all seven agents run in spec order and the workflow completes with a sent invite', async () => {
    const sent = [];
    const sendEmail = async (args) => {
      sent.push(args);
      return { template_id: args.templateId, template_version: '1.0.0', subject: `Interview invitation: ${args.variables.job_title}`, delivery: 'sent', provider_id: 'em_123' };
    };
    const runner = h.makeRunner({ sendEmail });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const wf = await approveAndWait(runner, recruiter, a.workflow.id);

    expect(wf.status).toBe('completed');
    expect(wf.current_state).toBeNull();
    expect(Object.fromEntries([...wf.node_states.entries()].map(([k, v]) => [k, `${v.status}/${v.attempts}`]))).toEqual({
      resume_parser: 'success/1',
      embedding_agent: 'success/1',
      matching_agent: 'success/1',
      shortlisting_agent: 'success/1',
      human_approval: 'success/1',
      interview_agent: 'success/1',
      email_agent: 'success/1',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'john@example.com', templateId: 'interview-invite', idempotencyKey: `agenthire-${a.workflow.id}-interview-invite` });

    const detail = await request(app).get(`/workflow/${a.workflow.id}`).set(recruiter.auth);
    expect(detail.body.data.state_output.email_agent).toMatchObject({ delivery: 'sent', provider_id: 'em_123', recipient: 'j***@example.com' });
    expect(JSON.stringify(detail.body.data.state_output.email_agent)).not.toContain('john@example.com');

    const cand = await request(app).get(`/candidates/${a.candidate_id}`).set(recruiter.auth);
    expect(cand.body.data.candidate.status).toBe('approved');
    expect(cand.body.data.candidate.screening.interview.questions.length).toBeGreaterThan(0);
    expect(cand.body.data.candidate.screening.email.template_id).toBe('interview-invite');

    const status = await request(app).get(`/candidates/status/${a.status_token}`);
    expect(status.body.data.stage).toBe('decision_made');

    const summary = await request(app).get('/dashboard/summary').set(recruiter.auth);
    expect(summary.body.data.workflows).toMatchObject({ completion_rate: 100, by_status: expect.objectContaining({ completed: 1 }) });
  });

  test('a transient email failure is retried by the retry policy', async () => {
    let failures = 2;
    const sendEmail = async (args) => {
      if (failures-- > 0) throw new EmailDeliveryError('Resend 503', 'EMAIL_API_FAILURE');
      return { template_id: args.templateId, template_version: '1.0.0', subject: 's', delivery: 'sent', provider_id: 'em_9' };
    };
    const runner = h.makeRunner({ sendEmail });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const wf = await approveAndWait(runner, recruiter, a.workflow.id);
    expect(wf.status).toBe('completed');
    expect(wf.node_states.get('email_agent')).toMatchObject({ status: 'success', attempts: 3 });
    expect(wf.node_states.get('interview_agent').attempts).toBe(1); // earlier node not re-run
  });

  test('an email configuration error fails without retries and keeps the recruiter decision', async () => {
    const sendEmail = async () => {
      throw new EmailDeliveryError('You can only send testing emails to your own email address', 'EMAIL_CONFIG_ERROR');
    };
    const runner = h.makeRunner({ sendEmail });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const wf = await approveAndWait(runner, recruiter, a.workflow.id);
    expect(wf.status).toBe('failed');
    expect(wf.node_states.get('email_agent')).toMatchObject({ status: 'failed', attempts: 1 });
    expect(wf.last_error).toMatchObject({ agent_name: 'email_agent', code: 'EMAIL_CONFIG_ERROR', retryable: false });
    expect((await Candidate.findById(a.candidate_id)).status).toBe('approved');
  });

  test('a workflow that failed at a later step resumes to completion on retry (Phase 6 → 7 upgrade path)', async () => {
    // First engine: interview step not available (as in Phase 6).
    const old = h.makeRunner({
      handlersOverride: {
        interview_agent: async () => {
          throw new AgentError('NOT_IMPLEMENTED', 'The interview agent is implemented in Phase 7');
        },
      },
    });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(old, job.id);
    const failed = await approveAndWait(old, recruiter, a.workflow.id);
    expect(failed.last_error).toMatchObject({ agent_name: 'interview_agent', code: 'NOT_IMPLEMENTED' });

    // Upgraded engine, same checkpoints: retry continues from interview_agent.
    const runner = h.makeRunner();
    const res = await request(app).post('/workflow/retry').set(recruiter.auth).send({ workflow_id: a.workflow.id });
    expect(res.status).toBe(202);
    await runner.idle();
    const wf = await Workflow.findById(a.workflow.id);
    expect(wf.status).toBe('completed');
    expect(wf.node_states.get('human_approval').attempts).toBe(1);
    expect(wf.node_states.get('resume_parser').attempts).toBe(1);
    expect(await WorkflowLog.countDocuments({ workflow_id: a.workflow.id, agent_name: 'human_approval', status: 'success' })).toBe(1);
  });

  test('a rejected candidate gets the rejection email, with no interview kit', async () => {
    const sent = [];
    const sendEmail = async (args) => {
      sent.push(args.templateId);
      return { template_id: args.templateId, template_version: '1.0.0', subject: 's', delivery: 'not_configured' };
    };
    const runner = h.makeRunner({ sendEmail });
    const { recruiter, job } = await h.setupJob();
    const a = await h.applyAndWait(runner, job.id);
    const wf = await approveAndWait(runner, recruiter, a.workflow.id, 'reject', 'Position filled internally before review');
    expect(wf.status).toBe('completed');
    expect(sent).toEqual(['rejection']);
    expect(wf.node_states.get('interview_agent').status).toBe('skipped');
    expect(wf.approval).toMatchObject({ overridden: true });
  });
});
