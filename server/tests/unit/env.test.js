'use strict';

const { loadEnv } = require('../../src/config/env');

const base = {
  NODE_ENV: 'development',
  MONGODB_URI: 'mongodb://localhost/agenthire',
  JWT_SECRET: 'x'.repeat(40),
};

describe('environment validation', () => {
  test('applies defaults', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.JWT_EXPIRES_IN).toBe('7d');
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  test('treats empty optional secrets as unset', () => {
    const env = loadEnv({ ...base, RESEND_API_KEY: '', GROQ_API_KEY: '  ' });
    expect(env.RESEND_API_KEY).toBeUndefined();
    expect(env.GROQ_API_KEY).toBeUndefined();
  });

  test('rejects a short JWT secret without echoing its value', () => {
    const secret = 'short-secret-value';
    let error;
    try {
      loadEnv({ ...base, JWT_SECRET: secret });
    } catch (err) {
      error = err;
    }
    expect(error.code).toBe('INVALID_ENV');
    expect(error.message).toMatch(/JWT_SECRET/);
    expect(error.message).not.toContain(secret);
  });

  test('requires MONGODB_URI', () => {
    expect(() => loadEnv({ ...base, MONGODB_URI: undefined })).toThrow(/MONGODB_URI/);
  });

  test('the test run never loads credentials from server/.env', () => {
    const { getEnv } = require('../../src/config/env');
    expect(getEnv().NODE_ENV).toBe('test');
    expect(getEnv().GROQ_API_KEY).toBeUndefined();
    expect(getEnv().OPENROUTER_API_KEY).toBeUndefined();
    expect(getEnv().RESEND_API_KEY).toBeUndefined();
  });

  test('requires CORS_ORIGINS in production', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production' })).toThrow(/CORS_ORIGINS/);
    expect(loadEnv({ ...base, NODE_ENV: 'production', CORS_ORIGINS: 'https://a.example, https://b.example' }).CORS_ORIGINS).toEqual([
      'https://a.example',
      'https://b.example',
    ]);
  });
});
