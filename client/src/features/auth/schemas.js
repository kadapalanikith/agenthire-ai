import { z } from 'zod';

/**
 * Client-side form schemas. Password rules mirror the server policy served
 * by GET /meta/auth-policy (specs/system/auth-policy.json); the server
 * remains the authority and re-validates every request.
 */
export function buildPasswordSchema(policy) {
  let schema = z.string().min(1, 'Password is required');
  if (!policy) return schema;
  schema = schema
    .min(policy.min_length, `Use at least ${policy.min_length} characters`)
    .max(policy.max_length, `Use at most ${policy.max_length} characters`);
  if (policy.require_letter) schema = schema.regex(/[A-Za-z]/, 'Include at least one letter');
  if (policy.require_number) schema = schema.regex(/[0-9]/, 'Include at least one number');
  return schema;
}

export function describePasswordPolicy(policy) {
  if (!policy) return undefined;
  const parts = [`At least ${policy.min_length} characters`];
  if (policy.require_letter) parts.push('a letter');
  if (policy.require_number) parts.push('a number');
  return parts.length > 1 ? `${parts[0]}, including ${parts.slice(1).join(' and ')}.` : `${parts[0]}.`;
}

const email = z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address'));

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export function signupSchema(policy) {
  return z
    .object({
      name: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
      email,
      password: buildPasswordSchema(policy),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    })
    .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
}

export const forgotPasswordSchema = z.object({ email });

export function resetPasswordSchema(policy) {
  return z
    .object({
      password: buildPasswordSchema(policy),
      confirmPassword: z.string().min(1, 'Confirm your password'),
    })
    .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });
}
