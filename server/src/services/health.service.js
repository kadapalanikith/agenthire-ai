'use strict';

const { getEnv } = require('../config/env');
const { isDatabaseConnected } = require('../config/db');
const { isEmailConfigured } = require('../emails/emailService');

async function checkQdrant() {
  const env = getEnv();
  try {
    const res = await fetch(new URL('/readyz', env.QDRANT_URL), {
      headers: env.QDRANT_API_KEY ? { 'api-key': env.QDRANT_API_KEY } : {},
      signal: AbortSignal.timeout(2000),
    });
    return res.ok ? 'up' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Report dependency status. Only up/down and configured booleans are
 * returned — never URLs, keys or versions.
 */
async function getHealth() {
  const env = getEnv();
  const mongo = isDatabaseConnected() ? 'up' : 'down';
  const qdrant = await checkQdrant();
  return {
    status: mongo === 'up' ? (qdrant === 'up' ? 'ok' : 'degraded') : 'down',
    services: { mongo, qdrant },
    configured: {
      llm_primary: Boolean(env.GROQ_API_KEY),
      llm_fallback: Boolean(env.OPENROUTER_API_KEY),
      email: isEmailConfigured(),
    },
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getHealth };
