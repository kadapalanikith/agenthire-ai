'use strict';

const pino = require('pino');

// Paths that must never reach the logs.
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'token',
  '*.password',
  '*.token',
  '*.token_hash',
  '*.apiKey',
  '*.api_key',
  '*.secret',
];

function resolveLevel() {
  if (process.env.LOG_LEVEL) return process.env.LOG_LEVEL;
  return process.env.NODE_ENV === 'test' ? 'silent' : 'info';
}

const logger = pino({
  level: resolveLevel(),
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  base: { service: 'agenthire-server' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = { logger, REDACT_PATHS };
