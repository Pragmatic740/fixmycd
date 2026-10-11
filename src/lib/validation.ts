import { z } from 'zod';

/** Trim + lowercase so `A@x.com` and `a@x.com` are the same account. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? normalizeEmail(v) : v),
  z.email({ message: 'Enter a valid email address' }).max(254)
);

/** bcrypt only uses the first 72 bytes, so longer passwords would be silently truncated. */
export const newPasswordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes');

export const signupSchema = z.object({
  email: emailField,
  password: newPasswordField,
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
});

// Login accepts any existing password (older accounts predate the length rule).
export const loginSchema = z.object({
  email: z.preprocess((v) => (typeof v === 'string' ? normalizeEmail(v) : v), z.string().min(1).max(254)),
  password: z.string().min(1).max(1024),
});

export const betaSubscribeSchema = z.object({ email: emailField });
