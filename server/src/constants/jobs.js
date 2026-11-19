'use strict';

const JOB_STATUSES = Object.freeze(['open', 'closed']);

/** Field limits (data-shape constraints, not hiring rules). */
const JOB_LIMITS = Object.freeze({
  TITLE_MIN: 3,
  TITLE_MAX: 120,
  DESCRIPTION_MIN: 20,
  DESCRIPTION_MAX: 5000,
  SKILL_MAX_LENGTH: 50,
  REQUIRED_SKILLS_MAX: 30,
  PREFERRED_SKILLS_MAX: 30,
  MIN_EXPERIENCE_MAX: 50,
});

const PAGINATION = Object.freeze({ DEFAULT_LIMIT: 20, MAX_LIMIT: 50 });

module.exports = { JOB_STATUSES, JOB_LIMITS, PAGINATION };
