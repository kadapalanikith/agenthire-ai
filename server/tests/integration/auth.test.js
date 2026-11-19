'use strict';

jest.mock('../../src/emails/emailService', () => {
  const actual = jest.requireActual('../../src/emails/emailService');
  return { ...actual, sendTemplatedEmail: jest.fn(actual.sendTemplatedEmail) };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createApp } = require('../../src/app');
const { startDatabase, clearDatabase, stopDatabase } = require('../helpers/db');
const emailService = require('../../src/emails/emailService');
const User = require('../../src/models/User');
const PasswordResetToken = require('../../src/models/PasswordResetToken');

// Rate limiting itself is covered in system.test.js; relax it for functional tests.
const relaxed = { window_ms: 60000, max: 10000 };
const app = createApp({ rateLimits: { auth: relaxed, password_reset: relaxed } });
const valid = { name: 'Riley Recruiter', email: 'Riley@Example.com', password: 'Str0ngPassword' };

async function waitFor(fn, timeout = 5000) {
  const start = Date.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
}

async function signup(body = valid) {
  return request(app).post('/auth/signup').send(body);
}

beforeAll(startDatabase);
afterEach(async () => {
  await clearDatabase();
  emailService.sendTemplatedEmail.mockClear();
});
afterAll(stopDatabase);

describe('POST /auth/signup', () => {
  test('creates a recruiter, normalises email and returns a token', async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ name: 'Riley Recruiter', email: 'riley@example.com', role: 'recruiter' });
    expect(res.body.data.user.id).toMatch(/^[a-f0-9]{24}$/);
    expect(res.body.data.user.password).toBeUndefined();
    expect(typeof res.body.data.token).toBe('string');

    const stored = await User.findOne({ email: 'riley@example.com' }).select('+password');
    expect(stored.password).not.toBe(valid.password);
    expect(stored.password).toMatch(/^\$2[aby]\$12\$/);
  });

  test('rejects duplicate emails (case-insensitive)', async () => {
    await signup();
    const res = await signup({ ...valid, email: 'RILEY@example.com' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_IN_USE');
  });

  test('enforces the password policy from specs/system/auth-policy.json', async () => {
    const res = await signup({ ...valid, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d) => d.path);
    expect(paths).toContain('password');
    const noNumber = await signup({ ...valid, password: 'OnlyLettersHere' });
    expect(noNumber.body.error.details[0].message).toMatch(/number/);
  });

  test('rejects unknown fields such as a self-assigned role', async () => {
    const res = await signup({ ...valid, role: 'admin' });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test('rejects an invalid email', async () => {
    const res = await signup({ ...valid, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('email');
  });
});

describe('POST /auth/login', () => {
  beforeEach(() => signup());

  test('issues a JWT for valid credentials', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'riley@example.com', password: valid.password });
    expect(res.status).toBe(200);
    const decoded = jwt.decode(res.body.data.token);
    expect(decoded).toMatchObject({ role: 'recruiter', iss: 'agenthire', aud: 'agenthire-app' });
    expect(decoded.sub).toBe(res.body.data.user.id);
  });

  test('returns the same error for a wrong password and an unknown email', async () => {
    const wrong = await request(app).post('/auth/login').send({ email: 'riley@example.com', password: 'Wrong1234' });
    const unknown = await request(app).post('/auth/login').send({ email: 'nobody@example.com', password: 'Wrong1234' });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toEqual(unknown.body.error);
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('blocks NoSQL operator injection', async () => {
    const res = await request(app).post('/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /auth/me', () => {
  test('returns the authenticated profile loaded from MongoDB', async () => {
    const { body } = await signup();
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe('riley@example.com');
  });

  test('requires a token', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('rejects tampered, foreign-signed and expired tokens', async () => {
    const { body } = await signup();
    const { token } = body.data;
    const tampered = `${token.slice(0, -2)}xx`;
    const foreign = jwt.sign({ role: 'admin' }, 'another-secret-another-secret-123456', {
      subject: body.data.user.id,
      issuer: 'agenthire',
      audience: 'agenthire-app',
    });
    const expired = jwt.sign({ role: 'recruiter' }, process.env.JWT_SECRET, {
      subject: body.data.user.id,
      issuer: 'agenthire',
      audience: 'agenthire-app',
      expiresIn: -10,
    });
    const none = jwt.sign({ role: 'admin', sub: body.data.user.id }, '', { algorithm: 'none' });

    for (const t of [tampered, foreign, none]) {
      const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${t}`);
      expect(res.status).toBe(401);
    }
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  test('rejects a valid token once the user no longer exists', async () => {
    const { body } = await signup();
    await User.deleteMany({});
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(401);
  });

  test('rejects users whose role is not allowed', async () => {
    const { body } = await signup();
    await User.collection.updateOne({ email: 'riley@example.com' }, { $set: { role: 'candidate' } });
    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${body.data.token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

describe('password reset', () => {
  async function requestReset(email) {
    const res = await request(app).post('/auth/forgot-password').send({ email });
    expect(res.status).toBe(202);
    return res;
  }

  async function obtainResetToken() {
    await requestReset('riley@example.com');
    const call = await waitFor(() => emailService.sendTemplatedEmail.mock.calls[0]);
    return new URL(call[0].variables.reset_url).searchParams.get('token');
  }

  test('responds identically for known and unknown emails', async () => {
    await signup();
    const known = await requestReset('riley@example.com');
    const unknown = await requestReset('nobody@example.com');
    expect(known.body).toEqual(unknown.body);
    await waitFor(() => emailService.sendTemplatedEmail.mock.calls.length === 1);
  });

  test('stores only a hash of the token and builds the link from PUBLIC_WEB_URL', async () => {
    await signup();
    const token = await obtainResetToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const call = emailService.sendTemplatedEmail.mock.calls[0][0];
    expect(call.templateId).toBe('password-reset');
    expect(call.variables.reset_url.startsWith('http://localhost:8081/reset-password?token=')).toBe(true);
    const record = await PasswordResetToken.findOne({});
    expect(record.token_hash).not.toBe(token);
    expect(record.token_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  test('resets the password once, invalidates old sessions and rejects reuse', async () => {
    const { body } = await signup();
    const oldToken = body.data.token;
    // Ensure the reset happens in a later second than the original token's iat.
    await new Promise((r) => setTimeout(r, 1100));
    const token = await obtainResetToken();

    const reset = await request(app).post('/auth/reset-password').send({ token, password: 'N3wPassword!' });
    expect(reset.status).toBe(200);

    const reuse = await request(app).post('/auth/reset-password').send({ token, password: 'An0therPass' });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe('INVALID_RESET_TOKEN');

    const oldSession = await request(app).get('/auth/me').set('Authorization', `Bearer ${oldToken}`);
    expect(oldSession.status).toBe(401);

    const loginOld = await request(app).post('/auth/login').send({ email: valid.email, password: valid.password });
    expect(loginOld.status).toBe(401);
    const loginNew = await request(app).post('/auth/login').send({ email: valid.email, password: 'N3wPassword!' });
    expect(loginNew.status).toBe(200);
  });

  test('rejects expired tokens', async () => {
    await signup();
    const token = await obtainResetToken();
    await PasswordResetToken.updateMany({}, { $set: { expires_at: new Date(Date.now() - 1000) } });
    const res = await request(app).post('/auth/reset-password').send({ token, password: 'N3wPassword!' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN');
  });

  test('a new request invalidates the previous token', async () => {
    await signup();
    const first = await obtainResetToken();
    emailService.sendTemplatedEmail.mockClear();
    const second = await obtainResetToken();
    expect(second).not.toBe(first);
    const res = await request(app).post('/auth/reset-password').send({ token: first, password: 'N3wPassword!' });
    expect(res.status).toBe(400);
  });

  test('validates the token format and new password policy', async () => {
    const res = await request(app).post('/auth/reset-password').send({ token: 'abc', password: 'short' });
    expect(res.status).toBe(400);
    expect([...new Set(res.body.error.details.map((d) => d.path))].sort()).toEqual(['password', 'token']);
  });
});
