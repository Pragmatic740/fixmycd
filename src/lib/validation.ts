import { z } from 'zod';
import { EVIDENCE_TYPES, FAILURE_TYPES, POST_ACTIONS, POST_TYPES, REPORT_STATUSES } from './categories';
import { isAllowedMediaUrl, type MediaKind } from './media-url';


/**
 * Strip NUL and other control characters (keeping tab/newline). Postgres
 * rejects NUL bytes outright, and the rest only cause rendering problems.
 */
export function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, '');
}
const CONTROL_CHARS = new RegExp('[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]', 'g');

/** User-facing text field: control characters stripped, then trimmed. */
const text = () => z.string().transform(stripControlChars).pipe(z.string().trim());

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
  displayName: text().pipe(z.string().min(1, 'Display name is required').max(80)),
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

export const commentSchema = z.object({
  body: text().pipe(z.string().min(1, 'Comment cannot be empty').max(1000, 'Comment must be at most 1000 characters')),
});

export const profilePatchSchema = z
  .object({
    displayName: text().pipe(z.string().min(1, 'Display name is required').max(80)).optional(),
    bio: text().pipe(z.string().max(500)).optional(),
    emailNotifications: z.boolean().optional(),
  })
  .strict();

export const flagSchema = z.object({
  reason: text().pipe(z.string().min(1, 'Reason is required').max(500)),
  targetType: z.enum(['report', 'comment']).default('report'),
});

export const FOLLOW_TYPES = ['user', 'report', 'area'] as const;
export const followSchema = z.object({
  followType: z.enum(FOLLOW_TYPES),
  targetId: z.string().trim().min(1).max(100),
});

export const notificationsPatchSchema = z.union([
  z.object({ markAllRead: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1).max(100)).min(1).max(100) }),
]);

export const notificationsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: z.iso.datetime({ offset: true }).optional(),
  unread: z.enum(['true', 'false']).optional(),
});

export const savedSearchSchema = z.object({
  name: text().pipe(z.string().min(1).max(80)),
  queryJson: z.union([z.string().max(4000), z.record(z.string(), z.unknown())]),
});

export const idBodySchema = z.object({ id: z.string().min(1).max(100) });

export const endorsementSchema = z.object({
  severityLevel: z.number().int('Severity must be a whole number').min(1).max(5),
  note: text()
    .pipe(z.string().max(500, 'Note must be at most 500 characters'))
    .optional()
    .transform((n) => (n ? n : null)),
});

export const reviewPatchSchema = z
  .object({
    status: z.enum(REPORT_STATUSES).optional(),
    reviewNote: text().pipe(z.string().max(1000)).optional(),
    isHidden: z.boolean().optional(),
    featured: z.boolean().optional(),
  })
  .refine((b) => Object.values(b).some((v) => v !== undefined), { message: 'Nothing to change' });

// ---------------------------------------------------------------------------
// Reports

/** Treat '', null and undefined as "not provided" (HTML inputs send ''). */
const blankToUndefined = (v: unknown) => (v === '' || v === null ? undefined : v);

const optionalNumber = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().refine(Number.isFinite, 'Must be a number').min(min).max(max).optional());
const optionalInt = (min: number, max: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).optional());
const optionalText = (max: number) =>
  z.preprocess(blankToUndefined, text().pipe(z.string().max(max)).optional());

const mediaUrl = (kind: MediaKind) =>
  z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine((u) => isAllowedMediaUrl(u, kind), `Upload the ${kind} through the app (unsupported ${kind} URL)`)
      .optional()
  );

export const reportCreateSchema = z.object({
  title: text().pipe(z.string().min(3, 'Title must be at least 3 characters').max(140)),
  description: optionalText(5000),
  latitude: z.coerce.number().refine(Number.isFinite, 'Latitude is required').min(-90).max(90),
  longitude: z.coerce.number().refine(Number.isFinite, 'Longitude is required').min(-180).max(180),
  severity: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(5).default(1)),
  imageUrl: mediaUrl('image'),
  videoUrl: mediaUrl('video'),
  audioUrl: mediaUrl('audio'),
  category: optionalText(80),
  subcategory: optionalText(80),
  infrastructureClass: optionalText(80),
  infrastructureType: optionalText(80),
  failureType: z.preprocess(blankToUndefined, z.enum(FAILURE_TYPES).optional()),
  suspectedCause: optionalText(500),
  assetName: optionalText(200),
  responsibleAgency: optionalText(200),
  isRecurrence: z.boolean().optional(),
  postAction: z.preprocess(blankToUndefined, z.enum(POST_ACTIONS).default('failure')),
  postType: z.preprocess(blankToUndefined, z.enum(POST_TYPES).default('new')),
  parentReportId: optionalText(100),
  compassDirection: optionalNumber(0, 360),
  evidenceType: z.preprocess(blankToUndefined, z.enum(EVIDENCE_TYPES).optional()),
  observationConfidence: optionalInt(1, 5),
  estimatedCostLow: optionalNumber(0, 1e12),
  estimatedCostHigh: optionalNumber(0, 1e12),
  actualCost: optionalNumber(0, 1e12),
  currency: z.preprocess(blankToUndefined, z.string().regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code').default('USD')),
  costEstimateSource: z.preprocess(
    blankToUndefined,
    z.enum(['citizen_estimate', 'agency_estimate', 'contractor_quote', 'official_record', 'csv_import']).optional()
  ),
  costConfidence: optionalInt(1, 5),
  peopleAffected: optionalInt(0, 1e9),
  householdsAffected: optionalInt(0, 1e9),
  outageDurationHours: optionalNumber(0, 1e6),
  safetyImpact: z.boolean().optional(),
  accessibilityImpact: z.boolean().optional(),
  environmentalImpact: z.boolean().optional(),
  tags: z.preprocess(
    (v) => (Array.isArray(v) ? v.join(',') : blankToUndefined(v)),
    z.string().max(500).optional()
  ),
  occurredAt: z.preprocess(
    blankToUndefined,
    z.iso
      .datetime({ offset: true })
      .refine((d) => new Date(d).getTime() <= Date.now() + 24 * 3600 * 1000, 'Date cannot be in the future')
      .optional()
  ),
  addressLine: optionalText(300),
  city: optionalText(120),
  postalCode: optionalText(20),
  county: optionalText(120),
  stateProvince: optionalText(120),
  countryCode: z.preprocess(blankToUndefined, z.string().regex(/^[A-Z]{2}$/).optional().catch(undefined)),
});

const dateParam = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/, 'Use YYYY-MM-DD')
  .refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date');

const qNumber = (min: number, max: number) => z.preprocess(blankToUndefined, z.coerce.number().min(min).max(max).optional());
const qInt = (min: number, max: number) => z.preprocess(blankToUndefined, z.coerce.number().int().min(min).max(max).optional());

export const reportFeedQuery = z
  .object({
    category: optionalText(80),
    status: z.preprocess(blankToUndefined, z.enum(REPORT_STATUSES).optional()),
    severity: qInt(1, 5),
    severityMin: qInt(1, 5),
    severityMax: qInt(1, 5),
    keyword: optionalText(100),
    featured: z.preprocess(blankToUndefined, z.enum(['true', 'false']).optional()),
    endorsed: z.preprocess(blankToUndefined, z.enum(['true', 'false']).optional()),
    userId: optionalText(100),
    limit: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(100).default(50)),
    offset: z.preprocess(blankToUndefined, z.coerce.number().int().min(0).max(100_000).default(0)),
    startDate: z.preprocess(blankToUndefined, dateParam.optional()),
    endDate: z.preprocess(blankToUndefined, dateParam.optional()),
    west: qNumber(-180, 180),
    south: qNumber(-90, 90),
    east: qNumber(-180, 180),
    north: qNumber(-90, 90),
    radiusLat: qNumber(-90, 90),
    radiusLng: qNumber(-180, 180),
    radiusKm: qNumber(0.1, 500),
  })
  .refine((q) => (q.radiusKm === undefined) === (q.radiusLat === undefined) && (q.radiusLat === undefined) === (q.radiusLng === undefined), {
    message: 'radiusKm needs radiusLat and radiusLng',
    path: ['radiusKm'],
  })
  .refine(
    (q) => [q.west, q.south, q.east, q.north].every((v) => v === undefined) || [q.west, q.south, q.east, q.north].every((v) => v !== undefined),
    { message: 'Bounding box needs west, south, east and north', path: ['west'] }
  )
  .refine((q) => q.south === undefined || q.north === undefined || q.south <= q.north, {
    message: 'south must be <= north',
    path: ['south'],
  })
  .refine((q) => q.severityMin === undefined || q.severityMax === undefined || q.severityMin <= q.severityMax, {
    message: 'severityMin must be <= severityMax',
    path: ['severityMin'],
  })
  .refine((q) => !q.startDate || !q.endDate || Date.parse(q.startDate) <= Date.parse(q.endDate), {
    message: 'startDate must be before endDate',
    path: ['startDate'],
  });

export type ReportFeedQuery = z.output<typeof reportFeedQuery>;

export const shareCreateSchema = z.object({
  filters: z.record(z.string(), z.unknown()),
  label: z.preprocess(blankToUndefined, text().pipe(z.string().max(120)).optional()),
  savedViewId: z.preprocess(blankToUndefined, z.string().max(100).optional()),
  expiresAt: z.preprocess(
    blankToUndefined,
    z.iso
      .datetime({ offset: true })
      .or(z.iso.date())
      .refine((d) => new Date(d).getTime() > Date.now(), 'Expiry must be in the future')
      .optional()
  ),
});

export const unsubscribeSchema = z.object({
  u: z.string().min(1).max(100),
  t: z.string().min(1).max(200),
});
