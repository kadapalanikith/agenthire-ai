'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const { createRecruiter } = require('../helpers/auth');
const User = require('../../src/models/User');
const Job = require('../../src/models/Job');

const relaxed = { window_ms: 60000, max: 100000 };
const app = createApp({ rateLimits: { auth: relaxed, password_reset: relaxed, general: relaxed } });

const validJob = {
  title: 'Frontend Developer',
  description: 'Build accessible, fast interfaces for our recruiter console using React.',
  required_skills: ['React', 'JavaScript', 'CSS'],
  preferred_skills: ['Next.js', 'Tailwind CSS'],
  min_experience: 2,
  hiring_spec_id: 'frontend-developer',
};

async function createJob(auth, body = validJob) {
  return request(app).post('/jobs').set(auth).send(body);
}

beforeAll(startDatabase);
afterEach(clearDatabase);
afterAll(stopDatabase);

describe('POST /jobs', () => {
  test('creates a job owned by the recruiter with spec references and share links', async () => {
    const { auth, user } = await createRecruiter(app);
    const res = await createJob(auth);
    expect(res.status).toBe(201);
    const { job } = res.body.data;
    expect(job).toMatchObject({
      title: 'Frontend Developer',
      required_skills: ['React', 'JavaScript', 'CSS'],
      preferred_skills: ['Next.js', 'Tailwind CSS'],
      min_experience: 2,
      hiring_spec_id: 'frontend-developer',
      workflow_spec_id: 'default-hiring-workflow',
      created_by: user.id,
      status: 'open',
      hiring_spec: { id: 'frontend-developer', role: 'Frontend Developer', version: '1.0.0' },
    });
    expect(job.public_url).toBe(`http://localhost:8081/jobs/${job.id}`);
    expect(job.apply_url).toBe(`http://localhost:8081/jobs/${job.id}/apply`);
  });

  test('requires recruiter authentication', async () => {
    const res = await createJob({});
    expect(res.status).toBe(401);
    expect(await Job.countDocuments()).toBe(0);
  });

  test('normalises skills: trims, collapses whitespace, removes case-insensitive duplicates', async () => {
    const { auth } = await createRecruiter(app);
    const res = await createJob(auth, {
      ...validJob,
      required_skills: ['  React ', 'react', 'Java   Script', 'CSS'],
      preferred_skills: ['next.js', 'Next.js'],
    });
    expect(res.status).toBe(201);
    expect(res.body.data.job.required_skills).toEqual(['React', 'Java Script', 'CSS']);
    expect(res.body.data.job.preferred_skills).toEqual(['next.js']);
  });

  test('rejects a skill listed as both required and preferred', async () => {
    const { auth } = await createRecruiter(app);
    const res = await createJob(auth, { ...validJob, preferred_skills: ['react'] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ path: 'preferred_skills' });
  });

  test('validates required fields and ranges', async () => {
    const { auth } = await createRecruiter(app);
    const res = await createJob(auth, {
      title: 'x',
      description: 'short',
      required_skills: [],
      min_experience: -1,
      hiring_spec_id: 'frontend-developer',
    });
    expect(res.status).toBe(400);
    const paths = res.body.error.details.map((d) => d.path).sort();
    expect(paths).toEqual(expect.arrayContaining(['title', 'description', 'required_skills', 'min_experience']));
  });

  test('rejects unknown hiring or workflow specs', async () => {
    const { auth } = await createRecruiter(app);
    const badHiring = await createJob(auth, { ...validJob, hiring_spec_id: 'astronaut' });
    expect(badHiring.status).toBe(400);
    expect(badHiring.body.error.details[0].path).toBe('hiring_spec_id');
    const badWorkflow = await createJob(auth, { ...validJob, workflow_spec_id: 'other-workflow' });
    expect(badWorkflow.status).toBe(400);
    expect(badWorkflow.body.error.details[0].path).toBe('workflow_spec_id');
  });

  test('rejects client-controlled ownership or status fields', async () => {
    const { auth } = await createRecruiter(app);
    const res = await createJob(auth, { ...validJob, created_by: 'a'.repeat(24), status: 'closed' });
    expect(res.status).toBe(400);
  });

  test('rejects markup-like characters in skills', async () => {
    const { auth } = await createRecruiter(app);
    const res = await createJob(auth, { ...validJob, required_skills: ['<script>'] });
    expect(res.status).toBe(400);
  });
});

describe('GET /jobs', () => {
  test('public listing shows only open jobs with public fields', async () => {
    const a = await createRecruiter(app);
    const open = (await createJob(a.auth)).body.data.job;
    const closed = (await createJob(a.auth, { ...validJob, title: 'Closed role' })).body.data.job;
    await request(app).put(`/jobs/${closed.id}`).set(a.auth).send({ status: 'closed' });

    const res = await request(app).get('/jobs');
    expect(res.status).toBe(200);
    expect(res.body.data.jobs.map((j) => j.id)).toEqual([open.id]);
    const [job] = res.body.data.jobs;
    expect(job.created_by).toBeUndefined();
    expect(job.hiring_spec_id).toBeUndefined();
    expect(job.apply_url).toMatch(/\/apply$/);
  });

  test('scope=mine lists only the recruiter’s jobs, any status, with status filter', async () => {
    const a = await createRecruiter(app);
    const b = await createRecruiter(app);
    const mine = (await createJob(a.auth)).body.data.job;
    await createJob(b.auth, { ...validJob, title: 'Other recruiter role' });
    await request(app).put(`/jobs/${mine.id}`).set(a.auth).send({ status: 'closed' });

    const all = await request(app).get('/jobs?scope=mine').set(a.auth);
    expect(all.body.data.jobs).toHaveLength(1);
    expect(all.body.data.jobs[0]).toMatchObject({ id: mine.id, status: 'closed', created_by: a.user.id });

    const open = await request(app).get('/jobs?scope=mine&status=open').set(a.auth);
    expect(open.body.data.jobs).toHaveLength(0);
  });

  test('scope=mine without a token is rejected', async () => {
    const res = await request(app).get('/jobs?scope=mine');
    expect(res.status).toBe(401);
  });

  test('an invalid token on a public route is rejected rather than ignored', async () => {
    const res = await request(app).get('/jobs').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  test('paginates newest first with metadata', async () => {
    const { auth } = await createRecruiter(app);
    for (let i = 1; i <= 5; i += 1) await createJob(auth, { ...validJob, title: `Role number ${i}` });
    const page1 = await request(app).get('/jobs?scope=mine&limit=2&page=1').set(auth);
    const page3 = await request(app).get('/jobs?scope=mine&limit=2&page=3').set(auth);
    expect(page1.body.meta).toEqual({ page: 1, limit: 2, total: 5, total_pages: 3 });
    expect(page1.body.data.jobs.map((j) => j.title)).toEqual(['Role number 5', 'Role number 4']);
    expect(page3.body.data.jobs.map((j) => j.title)).toEqual(['Role number 1']);
  });

  test('searches titles case-insensitively and treats regex characters literally', async () => {
    const { auth } = await createRecruiter(app);
    await createJob(auth, { ...validJob, title: 'Senior React Engineer' });
    await createJob(auth, { ...validJob, title: 'Data Analyst (SQL)' });
    const react = await request(app).get('/jobs?q=react');
    expect(react.body.data.jobs.map((j) => j.title)).toEqual(['Senior React Engineer']);
    const literal = await request(app).get('/jobs?q=(SQL)');
    expect(literal.body.data.jobs).toHaveLength(1);
    const wildcard = await request(app).get('/jobs?q=.*');
    expect(wildcard.body.data.jobs).toHaveLength(0);
  });

  test('validates query parameters', async () => {
    const res = await request(app).get('/jobs?limit=500&scope=everyone');
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['limit', 'scope']);
  });

  test('ignores injected operators in the query string', async () => {
    const { auth } = await createRecruiter(app);
    await createJob(auth);
    const res = await request(app).get('/jobs?status[$ne]=open');
    expect(res.status).toBe(400);
  });
});

describe('GET /jobs/:id', () => {
  test('is public and returns the public view to anonymous users', async () => {
    const { auth } = await createRecruiter(app);
    const job = (await createJob(auth)).body.data.job;
    const res = await request(app).get(`/jobs/${job.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.can_manage).toBe(false);
    expect(res.body.data.job.title).toBe('Frontend Developer');
    expect(res.body.data.job.created_by).toBeUndefined();
  });

  test('returns the full view to the owner', async () => {
    const { auth, user } = await createRecruiter(app);
    const job = (await createJob(auth)).body.data.job;
    const res = await request(app).get(`/jobs/${job.id}`).set(auth);
    expect(res.body.data.can_manage).toBe(true);
    expect(res.body.data.job.created_by).toBe(user.id);
  });

  test('returns the public view to other recruiters', async () => {
    const a = await createRecruiter(app);
    const b = await createRecruiter(app);
    const job = (await createJob(a.auth)).body.data.job;
    const res = await request(app).get(`/jobs/${job.id}`).set(b.auth);
    expect(res.body.data.can_manage).toBe(false);
  });

  test('returns 404 for unknown ids and 400 for malformed ids', async () => {
    expect((await request(app).get(`/jobs/${'a'.repeat(24)}`)).status).toBe(404);
    expect((await request(app).get('/jobs/not-an-id')).status).toBe(400);
  });
});

describe('PUT /jobs/:id', () => {
  test('updates fields and closes/reopens a job', async () => {
    const { auth } = await createRecruiter(app);
    const job = (await createJob(auth)).body.data.job;
    const res = await request(app)
      .put(`/jobs/${job.id}`)
      .set(auth)
      .send({ title: 'Senior Frontend Developer', min_experience: 4.5, required_skills: ['React', 'TypeScript'] });
    expect(res.status).toBe(200);
    expect(res.body.data.job).toMatchObject({
      title: 'Senior Frontend Developer',
      min_experience: 4.5,
      required_skills: ['React', 'TypeScript'],
      preferred_skills: ['Next.js', 'Tailwind CSS'],
    });

    const closed = await request(app).put(`/jobs/${job.id}`).set(auth).send({ status: 'closed' });
    expect(closed.body.data.job.status).toBe('closed');
    const reopened = await request(app).put(`/jobs/${job.id}`).set(auth).send({ status: 'open' });
    expect(reopened.body.data.job.status).toBe('open');
  });

  test('rejects overlap between new preferred skills and existing required skills', async () => {
    const { auth } = await createRecruiter(app);
    const job = (await createJob(auth)).body.data.job;
    const res = await request(app).put(`/jobs/${job.id}`).set(auth).send({ preferred_skills: ['CSS'] });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('preferred_skills');
  });

  test('forbids editing another recruiter’s job', async () => {
    const a = await createRecruiter(app);
    const b = await createRecruiter(app);
    const job = (await createJob(a.auth)).body.data.job;
    const res = await request(app).put(`/jobs/${job.id}`).set(b.auth).send({ title: 'Hijacked title' });
    expect(res.status).toBe(403);
    expect((await Job.findById(job.id)).title).toBe('Frontend Developer');
  });

  test('allows an admin to edit any job', async () => {
    const a = await createRecruiter(app);
    const admin = await createRecruiter(app);
    await User.updateOne({ _id: admin.user.id }, { $set: { role: 'admin' } });
    const job = (await createJob(a.auth)).body.data.job;
    const res = await request(app).put(`/jobs/${job.id}`).set(admin.auth).send({ status: 'closed' });
    expect(res.status).toBe(200);
  });

  test('rejects empty updates, unknown fields and anonymous callers', async () => {
    const { auth } = await createRecruiter(app);
    const job = (await createJob(auth)).body.data.job;
    expect((await request(app).put(`/jobs/${job.id}`).set(auth).send({})).status).toBe(400);
    expect((await request(app).put(`/jobs/${job.id}`).set(auth).send({ created_by: 'x' })).status).toBe(400);
    expect((await request(app).put(`/jobs/${job.id}`).send({ title: 'Anonymous edit' })).status).toBe(401);
  });
});

describe('GET /dashboard/summary', () => {
  test('counts only the recruiter’s jobs and lists recent ones', async () => {
    const a = await createRecruiter(app);
    const b = await createRecruiter(app);
    for (let i = 1; i <= 6; i += 1) await createJob(a.auth, { ...validJob, title: `Role number ${i}` });
    await createJob(b.auth);
    const recent = await request(app).get('/jobs?scope=mine&limit=1').set(a.auth);
    await request(app).put(`/jobs/${recent.body.data.jobs[0].id}`).set(a.auth).send({ status: 'closed' });

    const res = await request(app).get('/dashboard/summary').set(a.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.jobs).toEqual({ total: 6, open: 5, closed: 1 });
    expect(res.body.data.recent_jobs).toHaveLength(5);
    expect(res.body.data.recent_jobs[0].title).toBe('Role number 6');
  });

  test('returns zeros for a new recruiter and requires auth', async () => {
    const { auth } = await createRecruiter(app);
    const res = await request(app).get('/dashboard/summary').set(auth);
    expect(res.body.data.jobs).toEqual({ total: 0, open: 0, closed: 0 });
    expect((await request(app).get('/dashboard/summary')).status).toBe(401);
  });
});

describe('GET /meta/hiring-specs', () => {
  test('lists base role specs from /specs/hiring for recruiters', async () => {
    const { auth } = await createRecruiter(app);
    const res = await request(app).get('/meta/hiring-specs').set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data.hiring_specs).toEqual([
      expect.objectContaining({
        id: 'frontend-developer',
        role: 'Frontend Developer',
        required_skills: ['React', 'JavaScript', 'CSS'],
        minimum_score: 75,
      }),
    ]);
    expect((await request(app).get('/meta/hiring-specs')).status).toBe(401);
  });
});
