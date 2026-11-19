'use strict';

const { z } = require('zod');
const { CANDIDATE_LIMITS, CANDIDATE_STATUSES } = require('../constants/candidates');
const { objectId, pagination } = require('./common.validators');

const L = CANDIDATE_LIMITS;

const phone = z
  .string({ error: 'Phone number is required' })
  .trim()
  .regex(/^\+?[0-9 ().-]+$/, 'Use digits, spaces, +, -, ( or ) only')
  .refine((v) => {
    const digits = v.replace(/\D/g, '').length;
    return digits >= L.PHONE_MIN_DIGITS && digits <= L.PHONE_MAX_DIGITS;
  }, `Phone number must have ${L.PHONE_MIN_DIGITS}–${L.PHONE_MAX_DIGITS} digits`);

/** Text fields of the public multipart application (the file is validated separately). */
const applicationFields = z.strictObject({
  job_id: objectId,
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(L.NAME_MIN, 'Enter your full name')
    .max(L.NAME_MAX, `Name must be at most ${L.NAME_MAX} characters`)
    .regex(/^[^<>{}$]*$/, 'Name contains invalid characters'),
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email('Enter a valid email address')),
  phone,
});

const statusTokenParams = z.strictObject({ statusToken: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid status link') });

const listCandidatesQuery = z.strictObject({
  ...pagination,
  job_id: objectId.optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

const resumeQuery = z.strictObject({ access: z.string().max(2048).optional() });

module.exports = { applicationFields, statusTokenParams, listCandidatesQuery, resumeQuery };
