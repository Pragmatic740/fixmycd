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

export const USER_ROLES = ['viewer', 'submitter', 'referee', 'admin', 'super_admin'] as const;
export const USER_STATUSES = ['pending', 'approved', 'rejected'] as const;

export const adminUserPatchSchema = z
  .object({
    userId: z.string().min(1).max(100),
    disabled: z.boolean().optional(),
    role: z.enum(USER_ROLES).optional(),
    status: z.enum(USER_STATUSES).optional(),
  })
  .refine((b) => b.disabled !== undefined || b.role !== undefined || b.status !== undefined, {
    message: 'Nothing to change',
  });

export const adminUserListQuery = z.object({
  status: z.enum(USER_STATUSES).optional(),
});
