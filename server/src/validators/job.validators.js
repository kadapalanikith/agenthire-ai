'use strict';

const { z } = require('zod');
const { JOB_LIMITS, JOB_STATUSES } = require('../constants/jobs');
const { pagination } = require('./common.validators');

/** Trim, collapse inner whitespace, and drop case-insensitive duplicates (first spelling wins). */
function normalizeSkills(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const skill = raw.trim().replace(/\s+/g, ' ');
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      out.push(skill);
    }
  }
  return out;
}

const skill = z
  .string()
  .max(JOB_LIMITS.SKILL_MAX_LENGTH, `Each skill must be at most ${JOB_LIMITS.SKILL_MAX_LENGTH} characters`)
  .regex(/^[^<>{}$]*$/, 'Skills cannot contain <, >, {, } or $');

const skills = (max) => z.array(skill).max(max, `At most ${max} skills`).transform(normalizeSkills);

const title = z
  .string({ error: 'Title is required' })
  .trim()
  .min(JOB_LIMITS.TITLE_MIN, `Title must be at least ${JOB_LIMITS.TITLE_MIN} characters`)
  .max(JOB_LIMITS.TITLE_MAX, `Title must be at most ${JOB_LIMITS.TITLE_MAX} characters`);

const description = z
  .string({ error: 'Description is required' })
  .trim()
  .min(JOB_LIMITS.DESCRIPTION_MIN, `Description must be at least ${JOB_LIMITS.DESCRIPTION_MIN} characters`)
  .max(JOB_LIMITS.DESCRIPTION_MAX, `Description must be at most ${JOB_LIMITS.DESCRIPTION_MAX} characters`);

const minExperience = z
  .number({ error: 'Minimum experience must be a number of years' })
  .min(0, 'Minimum experience cannot be negative')
  .max(JOB_LIMITS.MIN_EXPERIENCE_MAX, `Minimum experience must be at most ${JOB_LIMITS.MIN_EXPERIENCE_MAX} years`)
  .multipleOf(0.5, 'Use whole or half years');

const specId = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid spec id');

function noOverlap(value, ctx) {
  if (!value.required_skills || !value.preferred_skills) return;
  const required = new Set(value.required_skills.map((s) => s.toLowerCase()));
  const dupes = value.preferred_skills.filter((s) => required.has(s.toLowerCase()));
  if (dupes.length) {
    ctx.addIssue({
      code: 'custom',
      path: ['preferred_skills'],
      message: `Already listed as required: ${dupes.join(', ')}`,
    });
  }
}

const createJob = z
  .strictObject({
    title,
    description,
    required_skills: skills(JOB_LIMITS.REQUIRED_SKILLS_MAX).refine((a) => a.length > 0, 'Add at least one required skill'),
    preferred_skills: skills(JOB_LIMITS.PREFERRED_SKILLS_MAX).default([]),
    min_experience: minExperience,
    hiring_spec_id: specId,
    workflow_spec_id: specId.optional(),
  })
  .superRefine(noOverlap);

const updateJob = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    required_skills: skills(JOB_LIMITS.REQUIRED_SKILLS_MAX)
      .refine((a) => a.length > 0, 'Add at least one required skill')
      .optional(),
    preferred_skills: skills(JOB_LIMITS.PREFERRED_SKILLS_MAX).optional(),
    min_experience: minExperience.optional(),
    hiring_spec_id: specId.optional(),
    workflow_spec_id: specId.optional(),
    status: z.enum(JOB_STATUSES).optional(),
  })
  .superRefine(noOverlap)
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const listJobsQuery = z.strictObject({
  ...pagination,
  scope: z.enum(['public', 'mine']).default('public'),
  status: z.enum(JOB_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

module.exports = { createJob, updateJob, listJobsQuery, normalizeSkills };
