'use strict';

const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const { createRecruiter } = require('../helpers/auth');
const { buildPdf } = require('../helpers/pdf');
const Candidate = require('../../src/models/Candidate');
const Workflow = require('../../src/models/Workflow');
const User = require('../../src/models/User');

const relaxed = { window_ms: 60000, max: 100000 };
const app = createApp({
  rateLimits: { auth: relaxed, password_reset: relaxed, general: relaxed, application_upload: relaxed, application_status: relaxed },
});
const UPLOAD_DIR = process.env.UPLOAD_DIR;

const jobBody = {
  title: 'Frontend Developer',
  description: 'Build accessible interfaces for our recruiter console using React.',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js'],
  min_experience: 2,
  hiring_spec_id: 'frontend-developer',
};

const applicant = { name: 'Jane Doe', email: 'Jane.Doe@Example.com', phone: '+1 (555) 123-4567' };

async function createJob(auth, body = jobBody) {
  return (await request(app).post('/jobs').set(auth).send(body)).body.data.job;
}

function apply(jobId, { fields = applicant, file = buildPdf(), filename = 'Jane Doe Resume.pdf', contentType = 'application/pdf' } = {}) {
  const req = request(app).post('/candidates/upload').field('job_id', jobId);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  if (file) req.attach('resume', file, { filename, contentType });
  return req;
}

function uploadedFiles() {
  return fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
}

beforeAll(startDatabase);
afterEach(async () => {
  await clearDatabase();
  fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });
});
afterAll(stopDatabase);

describe('POST /candidates/upload (public)', () => {
  test('creates the candidate, stores the PDF and a pending workflow from the spec — without recruiter auth', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const res = await apply(job.id);

    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data).toMatchObject({ status: 'applied', stage: 'received', job: { id: job.id, title: 'Frontend Developer' } });
    expect(data.status_token).toMatch(/^[a-f0-9]{64}$/);
    expect(data.workflow).toMatchObject({ status: 'pending', current_state: null, retry_count: 0 });

    const candidate = await Candidate.findById(data.candidate_id).select('+status_token_hash');
    expect(candidate).toMatchObject({ name: 'Jane Doe', email: 'jane.doe@example.com', phone: '+1 (555) 123-4567', status: 'applied' });
    expect(candidate.status_token_hash).not.toBe(data.status_token);
    expect(candidate.resume_file.original_name).toBe('Jane Doe Resume.pdf');
    expect(candidate.resume_url).toMatch(/^[a-f0-9-]{36}\.pdf$/);
    const stored = fs.readFileSync(path.join(UPLOAD_DIR, candidate.resume_url));
    expect(stored.equals(buildPdf())).toBe(true);

    const workflow = await Workflow.findById(data.workflow.id);
    expect(String(workflow.candidate_id)).toBe(data.candidate_id);
    expect(String(candidate.workflow_id)).toBe(data.workflow.id);
    expect(workflow.thread_id).toBe(data.workflow.id);
    expect(workflow.execution_order).toEqual([
      'resume_parser',
      'embedding_agent',
      'matching_agent',
      'shortlisting_agent',
      'human_approval',
      'interview_agent',
      'email_agent',
    ]);
    expect([...workflow.node_states.values()].every((n) => n.status === 'pending')).toBe(true);
    expect(workflow.spec_versions['evaluation/shortlisting-rules']).toBe('1.0.0');
  });

  test('rejects a non-PDF disguised with a .pdf name and PDF MIME type, and stores nothing', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const res = await apply(job.id, { file: Buffer.from('MZ\x90\x00 not a pdf at all'), filename: 'resume.pdf' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_PDF');
    expect(uploadedFiles()).toHaveLength(0);
    expect(await Candidate.countDocuments()).toBe(0);
  });

  test('rejects a truncated PDF', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const truncated = buildPdf().subarray(0, 200);
    const res = await apply(job.id, { file: truncated });
    expect(res.body.error.code).toBe('INVALID_PDF');
  });

  test('rejects other file types by MIME type or extension', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const docx = await apply(job.id, { filename: 'resume.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    expect(docx.status).toBe(400);
    expect(docx.body.error.code).toBe('INVALID_FILE_TYPE');
    const wrongExt = await apply(job.id, { filename: 'resume.exe' });
    expect(wrongExt.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  test('enforces the size limit from specs/system/upload-policy.json', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const big = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(5 * 1024 * 1024 + 10, 0x20), Buffer.from('\n%%EOF\n')]);
    const res = await apply(job.id, { file: big });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('FILE_TOO_LARGE');
    expect(uploadedFiles()).toHaveLength(0);
  });

  test('requires a resume file', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const res = await apply(job.id, { file: null });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('resume');
  });

  test('validates applicant fields and writes no file on failure', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const res = await apply(job.id, { fields: { name: 'J', email: 'nope', phone: '12' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'phone']);
    expect(uploadedFiles()).toHaveLength(0);
  });

  test('rejects unknown fields and injected operators', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const extra = await apply(job.id, { fields: { ...applicant, status: 'approved' } });
    expect(extra.status).toBe(400);
    const injected = await request(app)
      .post('/candidates/upload')
      .field('job_id', job.id)
      .field('name', 'Jane Doe')
      .field('email[$ne]', 'x')
      .field('phone', '+15551234567')
      .attach('resume', buildPdf(), { filename: 'r.pdf', contentType: 'application/pdf' });
    expect(injected.status).toBe(400);
    expect(await Candidate.countDocuments()).toBe(0);
  });

  test('returns 404 for unknown jobs and 409 for closed jobs', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    expect((await apply('a'.repeat(24))).status).toBe(404);
    await request(app).put(`/jobs/${job.id}`).set(auth).send({ status: 'closed' });
    const res = await apply(job.id);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('JOB_CLOSED');
    expect(uploadedFiles()).toHaveLength(0);
  });

  test('prevents duplicate applications for the same job and email (case-insensitive)', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    expect((await apply(job.id)).status).toBe(201);
    const dup = await apply(job.id, { fields: { ...applicant, email: 'JANE.DOE@example.com' } });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('ALREADY_APPLIED');
    expect(uploadedFiles()).toHaveLength(1);
    // A different job is fine.
    const other = await createJob(auth, { ...jobBody, title: 'Backend Developer' });
    expect((await apply(other.id)).status).toBe(201);
  });

  test('requires multipart/form-data', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const res = await request(app).post('/candidates/upload').send({ job_id: job.id, ...applicant });
    expect(res.status).toBe(415);
  });

  test('is rate limited by the upload policy', async () => {
    const limited = createApp({ rateLimits: { auth: relaxed, application_upload: { window_ms: 60000, max: 1 } } });
    const { auth } = await createRecruiter(limited);
    const job = (await request(limited).post('/jobs').set(auth).send(jobBody)).body.data.job;
    const send = (email) =>
      request(limited)
        .post('/candidates/upload')
        .field('job_id', job.id)
        .field('name', 'Jane Doe')
        .field('email', email)
        .field('phone', '+15551234567')
        .attach('resume', buildPdf(), { filename: 'r.pdf', contentType: 'application/pdf' });
    expect((await send('a@example.com')).status).toBe(201);
    expect((await send('b@example.com')).status).toBe(429);
  });
});

describe('GET /candidates/status/:statusToken (public)', () => {
  test('returns the stage without scores, contact details or recommendations', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const { status_token: token } = (await apply(job.id)).body.data;
    const res = await request(app).get(`/candidates/status/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ applicant_name: 'Jane', stage: 'received', job: { id: job.id, title: 'Frontend Developer' } });
    const body = JSON.stringify(res.body);
    for (const leaked of ['match_score', 'ai_recommendation', 'jane.doe@example.com', '555', 'resume']) {
      expect(body).not.toContain(leaked);
    }
  });

  test('maps internal statuses to public stages', async () => {
    const { auth } = await createRecruiter(app);
    const job = await createJob(auth);
    const { status_token: token, candidate_id: id } = (await apply(job.id)).body.data;
    for (const [status, stage] of [
      ['awaiting_review', 'in_review'],
      ['failed', 'in_review'],
      ['rejected', 'decision_made'],
    ]) {
      await Candidate.updateOne({ _id: id }, { $set: { status } });
      expect((await request(app).get(`/candidates/status/${token}`)).body.data.stage).toBe(stage);
    }
  });

  test('returns 404 for unknown tokens and 400 for malformed ones', async () => {
    expect((await request(app).get(`/candidates/status/${'f'.repeat(64)}`)).status).toBe(404);
    expect((await request(app).get('/candidates/status/abc')).status).toBe(400);
  });
});

describe('recruiter candidate endpoints', () => {
  async function setup() {
    const a = await createRecruiter(app);
    const b = await createRecruiter(app);
    const jobA = await createJob(a.auth);
    const jobB = await createJob(b.auth, { ...jobBody, title: 'Other recruiter role' });
    const appA = (await apply(jobA.id)).body.data;
    await apply(jobA.id, { fields: { name: 'Sam Lee', email: 'sam@example.com', phone: '+44 20 7946 0958' } });
    const appB = (await apply(jobB.id, { fields: { name: 'Kai Wu', email: 'kai@example.com', phone: '+61 2 9876 5432' } })).body.data;
    return { a, b, jobA, jobB, appA, appB };
  }

  test('lists only candidates for the recruiter’s jobs, with job and workflow summaries', async () => {
    const { a, jobA } = await setup();
    const res = await request(app).get('/candidates').set(a.auth);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(2);
    const [first] = res.body.data.candidates;
    expect(first).toMatchObject({ name: 'Sam Lee', status: 'applied', match_score: null, job: { id: jobA.id, title: 'Frontend Developer' } });
    expect(first.workflow).toMatchObject({ status: 'pending' });
    expect(first.resume_url).toBeUndefined();
    expect(first.status_token_hash).toBeUndefined();
  });

  test('filters by job, status and search; foreign job ids are not found', async () => {
    const { a, jobA, jobB } = await setup();
    const byJob = await request(app).get(`/candidates?job_id=${jobA.id}`).set(a.auth);
    expect(byJob.body.meta.total).toBe(2);
    expect((await request(app).get(`/candidates?job_id=${jobB.id}`).set(a.auth)).status).toBe(404);
    const search = await request(app).get('/candidates?q=jane').set(a.auth);
    expect(search.body.data.candidates.map((c) => c.name)).toEqual(['Jane Doe']);
    const byStatus = await request(app).get('/candidates?status=approved').set(a.auth);
    expect(byStatus.body.meta.total).toBe(0);
  });

  test('admins see every candidate', async () => {
    const { a } = await setup();
    await User.updateOne({ _id: a.user.id }, { $set: { role: 'admin' } });
    const res = await request(app).get('/candidates').set(a.auth);
    expect(res.body.meta.total).toBe(3);
  });

  test('candidate detail is owner-scoped and hides other recruiters’ candidates', async () => {
    const { a, b, appA } = await setup();
    const res = await request(app).get(`/candidates/${appA.candidate_id}`).set(a.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.candidate).toMatchObject({
      name: 'Jane Doe',
      email: 'jane.doe@example.com',
      resume_file: { original_name: 'Jane Doe Resume.pdf', mime_type: 'application/pdf' },
      workflow: { status: 'pending' },
    });
    expect((await request(app).get(`/candidates/${appA.candidate_id}`).set(b.auth)).status).toBe(404);
    expect((await request(app).get(`/candidates/${appA.candidate_id}`)).status).toBe(401);
  });

  test('streams the resume to the owner only', async () => {
    const { a, b, appA } = await setup();
    const res = await request(app).get(`/candidates/${appA.candidate_id}/resume`).set(a.auth).buffer(true).parse((r, cb) => {
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('inline; filename="Jane Doe Resume.pdf"');
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(res.body.equals(buildPdf())).toBe(true);
    expect((await request(app).get(`/candidates/${appA.candidate_id}/resume`).set(b.auth)).status).toBe(404);
    expect((await request(app).get(`/candidates/${appA.candidate_id}/resume`)).status).toBe(401);
  });

  test('issues short-lived signed resume links bound to one candidate', async () => {
    const { a, appA, appB } = await setup();
    const link = await request(app).get(`/candidates/${appA.candidate_id}/resume-link`).set(a.auth);
    expect(link.status).toBe(200);
    expect(link.body.data.path).toMatch(new RegExp(`^/candidates/${appA.candidate_id}/resume\\?access=`));
    expect(new Date(link.body.data.expires_at).getTime()).toBeGreaterThan(Date.now());

    const ok = await request(app).get(link.body.data.path);
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toBe('application/pdf');

    const access = new URL(`http://x${link.body.data.path}`).searchParams.get('access');
    const reused = await request(app).get(`/candidates/${appB.candidate_id}/resume?access=${encodeURIComponent(access)}`);
    expect(reused.status).toBe(401);
    // A normal login JWT is not accepted as a resume access token.
    const loginToken = a.token;
    expect((await request(app).get(`/candidates/${appA.candidate_id}/resume?access=${loginToken}`)).status).toBe(401);
  });

  test('dashboard summary counts candidates and workflows for the recruiter only', async () => {
    const { a, b } = await setup();
    const res = await request(app).get('/dashboard/summary').set(a.auth);
    expect(res.body.data.candidates).toMatchObject({ total: 2, by_status: expect.objectContaining({ applied: 2 }) });
    expect(res.body.data.workflows).toMatchObject({ total: 2, completion_rate: 0, by_status: expect.objectContaining({ pending: 2 }) });
    const other = await request(app).get('/dashboard/summary').set(b.auth);
    expect(other.body.data.candidates.total).toBe(1);
  });

  test('job detail includes the candidate count for the owner', async () => {
    const { a, jobA } = await setup();
    const res = await request(app).get(`/jobs/${jobA.id}`).set(a.auth);
    expect(res.body.data.job.candidate_count).toBe(2);
    const anon = await request(app).get(`/jobs/${jobA.id}`);
    expect(anon.body.data.job.candidate_count).toBeUndefined();
  });
});

describe('GET /meta/upload-policy (public)', () => {
  test('exposes resume rules from the spec', async () => {
    const res = await request(app).get('/meta/upload-policy');
    expect(res.body.data).toEqual({
      version: '1.1.0',
      max_size_bytes: 5242880,
      allowed_mime_types: ['application/pdf'],
      allowed_extensions: ['.pdf'],
    });
  });
});
