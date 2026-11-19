import {
  buildPasswordSchema,
  describePasswordPolicy,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
} from '../../src/features/auth/schemas';

const policy = { min_length: 8, max_length: 128, require_letter: true, require_number: true };

describe('auth form schemas', () => {
  test('password rules follow the server policy', () => {
    const schema = buildPasswordSchema(policy);
    expect(schema.safeParse('short1').success).toBe(false);
    expect(schema.safeParse('lettersonly').success).toBe(false);
    expect(schema.safeParse('12345678').success).toBe(false);
    expect(schema.safeParse('Str0ngPassword').success).toBe(true);
  });

  test('without a loaded policy only presence is checked (server still validates)', () => {
    const schema = buildPasswordSchema(undefined);
    expect(schema.safeParse('').success).toBe(false);
    expect(schema.safeParse('x').success).toBe(true);
  });

  test('describes the policy for hints', () => {
    expect(describePasswordPolicy(policy)).toBe('At least 8 characters, including a letter and a number.');
  });

  test('login trims and validates email', () => {
    expect(loginSchema.safeParse({ email: ' a@b.co ', password: 'x' }).data.email).toBe('a@b.co');
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
  });

  test('signup requires matching passwords', () => {
    const result = signupSchema(policy).safeParse({
      name: 'Riley Morgan',
      email: 'r@example.com',
      password: 'Str0ngPassword',
      confirmPassword: 'Different1',
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['confirmPassword']);
  });

  test('reset requires matching passwords that satisfy the policy', () => {
    expect(resetPasswordSchema(policy).safeParse({ password: 'N3wPassword', confirmPassword: 'N3wPassword' }).success).toBe(true);
    expect(resetPasswordSchema(policy).safeParse({ password: 'weak', confirmPassword: 'weak' }).success).toBe(false);
  });
});
