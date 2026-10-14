import crypto from 'crypto';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function secret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || null;
}

export function unsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(`unsubscribe:${userId}`).digest('base64url');
}

export function verifyUnsubscribeToken(userId: string, token: string): boolean {
  const expected = unsubscribeToken(userId);
  if (!expected || typeof token !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** One-click unsubscribe link for activity emails (undefined when no secret is configured). */
export function unsubscribeUrlFor(userId: string): string | undefined {
  const token = unsubscribeToken(userId);
  if (!token) return undefined;
  const url = new URL('/unsubscribe', BASE_URL);
  url.searchParams.set('u', userId);
  url.searchParams.set('t', token);
  return url.toString();
}
