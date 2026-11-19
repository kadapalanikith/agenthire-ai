'use strict';

const request = require('supertest');
const { createApp } = require('../../src/app');
const { startDatabase, stopDatabase } = require('../helpers/db');
const { disconnectDatabase } = require('../../src/config/db');

beforeAll(startDatabase);
afterAll(stopDatabase);

describe('GET /health', () => {
  test('reports dependency status without exposing configuration values', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      status: 'degraded', // Mongo up, Qdrant unreachable in tests
      services: { mongo: 'up', qdrant: 'down' },
      configured: { llm_primary: false, llm_fallback: false, email: false },
    });
    expect(JSON.stringify(res.body)).not.toMatch(/mongodb:\/\/|127\.0\.0\.1|secret/i);
  });
});

describe('GET /meta/workflow-spec', () => {
  test('serves workflow order and node states from /specs', async () => {
    const res = await request(createApp()).get('/meta/workflow-spec');
    expect(res.status).toBe(200);
    expect(res.body.data.workflow).toHaveLength(7);
    expect(res.body.data.workflow[4]).toBe('human_approval');
    expect(res.body.data.node_states.skipped.label).toBe('Skipped');
    expect(res.body.data.node_states.success.label).toBe('Completed');
    expect(res.body.data.branches.human_approval.reject.skip).toEqual(['interview_agent']);
  });
});

describe('GET /meta/auth-policy', () => {
  test('serves password rules only', async () => {
    const res = await request(createApp()).get('/meta/auth-policy');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['password', 'version']);
    expect(res.body.data.password.min_length).toBe(8);
  });
});

describe('HTTP hardening', () => {
  const app = createApp();

  test('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/meta/auth-policy');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('allows configured CORS origins only', async () => {
    const allowed = await request(app).get('/meta/auth-policy').set('Origin', 'http://localhost:8081');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:8081');
    const denied = await request(app).get('/meta/auth-policy').set('Origin', 'https://evil.example');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('returns the error envelope for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: { code: 'NOT_FOUND', message: 'Route GET /does-not-exist not found' } });
  });

  test('rejects malformed JSON bodies', async () => {
    const res = await request(app).post('/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('rejects oversized bodies', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('rate limits auth endpoints', async () => {
    const limited = createApp({ rateLimits: { auth: { window_ms: 60000, max: 2 } } });
    const body = { email: 'nobody@example.com', password: 'whatever1' };
    await request(limited).post('/auth/login').send(body);
    await request(limited).post('/auth/login').send(body);
    const res = await request(limited).post('/auth/login').send(body);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('when MongoDB is unavailable', () => {
  test('health reports down with 503', async () => {
    await disconnectDatabase();
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.data.services.mongo).toBe('down');
  });
});
