'use strict';

const { z } = require('zod');
const { getSpec } = require('../utils/specLoader');

/** Password rules come from specs/system/auth-policy.json. */
function passwordSchema() {
  const p = getSpec('system/auth-policy').password;
  let schema = z
    .string({ error: 'Password is required' })
    .min(p.min_length, `Password must be at least ${p.min_length} characters`)
    .max(p.max_length, `Password must be at most ${p.max_length} characters`);
  if (p.require_letter) schema = schema.regex(/[A-Za-z]/, 'Password must contain a letter');
  if (p.require_number) schema = schema.regex(/[0-9]/, 'Password must contain a number');
  return schema;
}

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address'));

const name = z
  .string({ error: 'Name is required' })
  .trim()
  .min(2, 'Name must be at least 2 characters')
  .max(100, 'Name must be at most 100 characters');

function buildAuthSchemas() {
  return {
    signup: z.strictObject({ name, email, password: passwordSchema() }),
    // Login only checks presence: policy changes must not lock out existing users.
    login: z.strictObject({ email, password: z.string({ error: 'Password is required' }).min(1, 'Password is required').max(1024) }),
    forgotPassword: z.strictObject({ email }),
    resetPassword: z.strictObject({
      token: z.string({ error: 'Reset token is required' }).regex(/^[a-f0-9]{64}$/, 'Reset token is invalid'),
      password: passwordSchema(),
    }),
  };
}

module.exports = { buildAuthSchemas };
