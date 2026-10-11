import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '../db';

export type RateLimitRule = {
  /** Max requests allowed per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

/** Limits per action. Generous enough for real use, tight enough to stop scripted abuse. */
export const RATE_LIMITS = {
  loginByIp: { limit: 30, windowSeconds: 15 * 60 },
  loginByAccount: { limit: 10, windowSeconds: 15 * 60 },
  signup: { limit: 5, windowSeconds: 60 * 60 },
  betaSubscribe: { limit: 5, windowSeconds: 60 * 60 },
  upload: { limit: 30, windowSeconds: 10 * 60 },
  geocode: { limit: 60, windowSeconds: 60 },
  pdf: { limit: 20, windowSeconds: 60 },
  comment: { limit: 20, windowSeconds: 10 * 60 },
  report: { limit: 20, windowSeconds: 60 * 60 },
  flag: { limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

/** Subjects can be emails; store only a hash of them. */
function bucketKey(bucket: string, subject: string): string {
  const digest = crypto.createHash('sha256').update(subject.toLowerCase()).digest('hex').slice(0, 32);
  return `${bucket}:${digest}`;
}

/**
 * Fixed-window counter stored in Postgres (works across serverless
 * instances without extra infrastructure). One atomic upsert per call.
 */
export async function checkRateLimit(
  bucket: string,
  subject: string,
  rule: RateLimitRule
): Promise<RateLimitResult> {
  const key = bucketKey(bucket, subject);
  const window = `${rule.windowSeconds} seconds`;
  const rows = await db.execute<{ count: number; window_start: Date | string }>(sql`
    INSERT INTO rate_limits (key, window_start, count)
    VALUES (${key}, now(), 1)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limits.window_start <= now() - ${window}::interval THEN 1 ELSE rate_limits.count + 1 END,
      window_start = CASE WHEN rate_limits.window_start <= now() - ${window}::interval THEN now() ELSE rate_limits.window_start END
    RETURNING count, window_start
  `);
  const row = Array.from(rows)[0];
  const count = Number(row.count);
  const windowStart = new Date(row.window_start).getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((windowStart + rule.windowSeconds * 1000 - Date.now()) / 1000));

  // Occasionally drop stale counters so the table stays small.
  if (Math.random() < 0.01) {
    await db.execute(sql`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
  }

  return { ok: count <= rule.limit, remaining: Math.max(0, rule.limit - count), retryAfterSeconds };
}

export function tooManyRequests(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please wait and try again.' },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSeconds) } }
  );
}

/** Check a limit and return a 429 response when exceeded (null when allowed). */
export async function enforceRateLimit(
  bucket: keyof typeof RATE_LIMITS,
  subject: string
): Promise<NextResponse | null> {
  const result = await checkRateLimit(bucket, subject, RATE_LIMITS[bucket]);
  return result.ok ? null : tooManyRequests(result);
}
