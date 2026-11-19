'use strict';

const qs = require('qs');

const MAX_DEPTH = 10;

function isDangerousKey(key) {
  return key.startsWith('$') || key.includes('.') || key === '__proto__' || key === 'constructor' || key === 'prototype';
}

/**
 * Recursively remove keys that could be interpreted as MongoDB operators or
 * cause prototype pollution, and strip NUL bytes from strings.
 * Returns a new value; the input is not mutated.
 */
function sanitizeValue(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (typeof value === 'string') return value.replace(/\0/g, '');
  if (Array.isArray(value)) return value.map((v) => sanitizeValue(v, depth + 1)).filter((v) => v !== undefined);
  if (value && typeof value === 'object') {
    if (Buffer.isBuffer(value)) return value;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isDangerousKey(k)) continue;
      const clean = sanitizeValue(v, depth + 1);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }
  return value;
}

/**
 * Express 5 exposes req.query as a getter, so query strings are sanitised
 * through the app's "query parser" setting instead (see app.js).
 */
function sanitizedQueryParser(str) {
  return sanitizeValue(qs.parse(str, { depth: 5, parameterLimit: 100, allowPrototypes: false }));
}

function sanitizeRequest(req, _res, next) {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.params && typeof req.params === 'object') {
    for (const key of Object.keys(req.params)) {
      if (typeof req.params[key] === 'string') req.params[key] = sanitizeValue(req.params[key]);
    }
  }
  next();
}

module.exports = { sanitizeRequest, sanitizeValue, sanitizedQueryParser };
