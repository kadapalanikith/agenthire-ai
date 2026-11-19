import { z } from 'zod';
import { findOverlap } from './skills';

/**
 * Client-side job form validation for immediate feedback. Field limits
 * mirror the API (server/src/constants/jobs.js); the server re-validates
 * everything and remains the authority.
 */
export const JOB_FORM_LIMITS = {
  TITLE_MIN: 3,
  TITLE_MAX: 120,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  SKILLS_MAX: 30,
  SKILL_MAX_LENGTH: 50,
  MIN_EXPERIENCE_MAX: 50,
};

const L = JOB_FORM_LIMITS;
const skills = z.array(z.string().max(L.SKILL_MAX_LENGTH)).max(L.SKILLS_MAX, `At most ${L.SKILLS_MAX} skills`);

export const jobFormSchema = z
  .object({
    title: z.string().trim().min(L.TITLE_MIN, `At least ${L.TITLE_MIN} characters`).max(L.TITLE_MAX, `At most ${L.TITLE_MAX} characters`),
    description: z
      .string()
      .trim()
      .min(L.DESCRIPTION_MIN, `Describe the role in at least ${L.DESCRIPTION_MIN} characters`)
      .max(L.DESCRIPTION_MAX, `At most ${L.DESCRIPTION_MAX} characters`),
    hiring_spec_id: z.string().min(1, 'Choose a base role'),
    required_skills: skills.min(1, 'Add at least one required skill'),
    preferred_skills: skills,
    min_experience: z
      .string()
      .trim()
      .min(1, 'Enter years of experience (0 for none)')
      .regex(/^\d+(\.5|\.0)?$/, 'Use whole or half years, e.g. 2 or 2.5')
      .refine((v) => Number(v) <= L.MIN_EXPERIENCE_MAX, `At most ${L.MIN_EXPERIENCE_MAX} years`),
    status: z.enum(['open', 'closed']).optional(),
  })
  .superRefine((v, ctx) => {
    const overlap = findOverlap(v.required_skills, v.preferred_skills);
    if (overlap.length) {
      ctx.addIssue({ code: 'custom', path: ['preferred_skills'], message: `Already required: ${overlap.join(', ')}` });
    }
  });

export const EMPTY_JOB_FORM = {
  title: '',
  description: '',
  hiring_spec_id: '',
  required_skills: [],
  preferred_skills: [],
  min_experience: '',
};

export function jobToFormValues(job) {
  return {
    title: job.title,
    description: job.description,
    hiring_spec_id: job.hiring_spec_id,
    required_skills: job.required_skills,
    preferred_skills: job.preferred_skills,
    min_experience: String(job.min_experience),
    status: job.status,
  };
}

/** Convert validated form values into the API payload. */
export function formValuesToPayload(values) {
  const payload = {
    title: values.title.trim(),
    description: values.description.trim(),
    hiring_spec_id: values.hiring_spec_id,
    required_skills: values.required_skills,
    preferred_skills: values.preferred_skills,
    min_experience: Number(values.min_experience),
  };
  if (values.status) payload.status = values.status;
  return payload;
}

/** API field names the form can display server validation errors for. */
export const JOB_FORM_FIELDS = ['title', 'description', 'hiring_spec_id', 'required_skills', 'preferred_skills', 'min_experience'];
