import { z } from 'zod';

/** Mirrors server/src/validators/candidate.validators.js; the server stays authoritative. */
export const applicationSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(100, 'Name is too long'),
  email: z.string().trim().min(1, 'Email is required').pipe(z.email('Enter a valid email address')),
  phone: z
    .string()
    .trim()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9 ().-]+$/, 'Use digits, spaces, +, -, ( or ) only')
    .refine((v) => {
      const digits = v.replace(/\D/g, '').length;
      return digits >= 7 && digits <= 15;
    }, 'Phone number must have 7–15 digits'),
});

export const APPLICATION_FIELDS = ['name', 'email', 'phone'];
