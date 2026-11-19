import { findOverlap, mergeSkills, parseSkillInput } from '../../src/features/jobs/skills';
import { formValuesToPayload, jobFormSchema, jobToFormValues } from '../../src/features/jobs/schemas';

describe('skill helpers', () => {
  test('parses comma and newline separated input', () => {
    expect(parseSkillInput(' React ,  Node.js\nCSS,, ')).toEqual(['React', 'Node.js', 'CSS']);
  });

  test('merges without case-insensitive duplicates', () => {
    expect(mergeSkills(['React'], ['react', 'CSS', 'css'])).toEqual(['React', 'CSS']);
  });

  test('finds overlap between required and preferred skills', () => {
    expect(findOverlap(['React', 'CSS'], ['css', 'Next.js'])).toEqual(['css']);
  });
});

describe('job form schema', () => {
  const valid = {
    title: 'Frontend Developer',
    description: 'Build accessible interfaces for our recruiter console.',
    hiring_spec_id: 'frontend-developer',
    required_skills: ['React'],
    preferred_skills: ['Next.js'],
    min_experience: '2.5',
  };

  test('accepts a valid job', () => {
    expect(jobFormSchema.safeParse(valid).success).toBe(true);
  });

  test('requires at least one required skill and a base role', () => {
    const r = jobFormSchema.safeParse({ ...valid, required_skills: [], hiring_spec_id: '' });
    expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(['hiring_spec_id', 'required_skills']);
  });

  test('accepts whole or half years only', () => {
    expect(jobFormSchema.safeParse({ ...valid, min_experience: '2.3' }).success).toBe(false);
    expect(jobFormSchema.safeParse({ ...valid, min_experience: '-1' }).success).toBe(false);
    expect(jobFormSchema.safeParse({ ...valid, min_experience: '0' }).success).toBe(true);
  });

  test('rejects preferred skills that duplicate required skills', () => {
    const r = jobFormSchema.safeParse({ ...valid, preferred_skills: ['react'] });
    expect(r.error.issues[0].path).toEqual(['preferred_skills']);
  });

  test('converts form values to the API payload and back', () => {
    const payload = formValuesToPayload({ ...valid, title: '  Frontend Developer  ' });
    expect(payload).toEqual({
      title: 'Frontend Developer',
      description: valid.description,
      hiring_spec_id: 'frontend-developer',
      required_skills: ['React'],
      preferred_skills: ['Next.js'],
      min_experience: 2.5,
    });
    expect(jobToFormValues({ ...payload, status: 'open' }).min_experience).toBe('2.5');
  });
});
