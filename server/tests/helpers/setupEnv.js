'use strict';

// Test-only configuration. Real values come from server/.env in development.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-characters-long';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/placeholder-overridden-by-memory-server';
process.env.CORS_ORIGINS = 'http://localhost:8081';
process.env.PUBLIC_WEB_URL = 'http://localhost:8081';
// Unreachable port so health checks deterministically report Qdrant as down.
process.env.QDRANT_URL = 'http://127.0.0.1:9';
delete process.env.RESEND_API_KEY;
delete process.env.GROQ_API_KEY;
delete process.env.OPENROUTER_API_KEY;
