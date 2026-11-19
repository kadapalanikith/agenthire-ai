'use strict';

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { createRecruiter } = require('./auth');
const { createFakeEmbedder } = require('./fakes');
const { buildHiringGraph } = require('../../src/workflows/hiringGraph');
const { createMongoCheckpointer } = require('../../src/workflows/checkpointer');
const { WorkflowRunner, setWorkflowRunner } = require('../../src/workflows/runner');
const { createMemoryStore } = require('../../src/rag/vectorStore.memory');

const relaxed = { window_ms: 60000, max: 100000 };
const DEMO_PDF = fs.readFileSync(path.resolve(__dirname, '../../../demo-data/resumes/john-react-resume.pdf'));

const JOB_BODY = {
  title: 'Frontend Developer',
  description: 'Build accessible interfaces for our recruiter console using React.',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js', 'Tailwind CSS'],
  min_experience: 2,
  hiring_spec_id: 'frontend-developer',
};

/** App + real LangGraph runner (Mongo checkpointer) with fake AI dependencies. */
function createHarness() {
  const app = createApp({ rateLimits: { auth: relaxed, general: relaxed, application_upload: relaxed, application_status: relaxed } });
  let checkpointer;

  return {
    app,
    async init() {
      checkpointer = await createMongoCheckpointer();
    },
    makeRunner({ embedder = createFakeEmbedder(), store = createMemoryStore(), handlersOverride, sendEmail, llm = null } = {}) {
      const graph = buildHiringGraph({ deps: { llm, embedder, store, sendEmail }, checkpointer, retryOverrides: { retry_delay_ms: 5 }, handlersOverride });
      const runner = new WorkflowRunner({ graph, concurrency: 2 });
      setWorkflowRunner(runner);
      return runner;
    },
    async setupJob() {
      const recruiter = await createRecruiter(app);
      const job = (await request(app).post('/jobs').set(recruiter.auth).send(JOB_BODY)).body.data.job;
      return { recruiter, job };
    },
    apply(jobId, { pdf = DEMO_PDF, email = 'john@example.com', name = 'John Carter' } = {}) {
      return request(app)
        .post('/candidates/upload')
        .field('job_id', jobId)
        .field('name', name)
        .field('email', email)
        .field('phone', '+1 555 010 0199')
        .attach('resume', pdf, { filename: 'resume.pdf', contentType: 'application/pdf' });
    },
    /** Upload and wait until the run pauses at human approval. */
    async applyAndWait(runner, jobId, opts) {
      const res = await this.apply(jobId, opts);
      await runner.idle();
      return res.body.data;
    },
  };
}

module.exports = { createHarness, DEMO_PDF, JOB_BODY, setWorkflowRunner };
